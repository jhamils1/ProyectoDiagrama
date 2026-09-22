import 'dart:convert';
import 'dart:io';

import 'local_store.dart';
import 'model.dart';

class ModelaApiException implements Exception {
  const ModelaApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class MobileProject {
  const MobileProject({
    required this.id,
    required this.name,
    required this.permission,
  });
  final String id;
  final String name;
  final String permission;
  factory MobileProject.fromJson(Map<String, dynamic> json) => MobileProject(
    id: json['id'] as String,
    name: json['nombre'] as String,
    permission: json['permiso'] as String,
  );
}

class MobileDiagramSummary {
  const MobileDiagramSummary({
    required this.id,
    required this.name,
    required this.revision,
  });
  final String id;
  final String name;
  final int revision;
  factory MobileDiagramSummary.fromJson(Map<String, dynamic> json) =>
      MobileDiagramSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        revision: (json['revision'] as num).toInt(),
      );
}

class SyncResult {
  const SyncResult(this.state, this.message);
  final LocalEditorState state;
  final String message;
}

class ModelaSession {
  const ModelaSession({required this.baseUrl, required this.cookies});
  final String baseUrl;
  final Map<String, String> cookies;

  Map<String, dynamic> toJson() => {'baseUrl': baseUrl, 'cookies': cookies};

  factory ModelaSession.fromJson(Map<String, dynamic> json) => ModelaSession(
    baseUrl: json['baseUrl'] as String,
    cookies: (json['cookies'] as Map<String, dynamic>).map(
      (key, value) => MapEntry(key, value as String),
    ),
  );
}

/// Session client for Modela's own API. Credentials are never persisted.
class ModelaApiClient {
  ModelaApiClient(
    this.baseUrl, {
    Map<String, String>? initialCookies,
    this.onSessionChanged,
  }) : _cookies = {...?initialCookies};
  final String baseUrl;
  final Map<String, String> _cookies;
  final void Function(ModelaSession session)? onSessionChanged;

  ModelaSession get session =>
      ModelaSession(baseUrl: baseUrl, cookies: Map.unmodifiable(_cookies));

  String get _apiBase {
    final uri = Uri.tryParse(baseUrl.trim());
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw const FormatException(
        'Escribe la URL completa del servidor Modela.',
      );
    }
    final root = uri
        .replace(path: uri.path.replaceFirst(RegExp(r'/+$'), ''))
        .toString();
    return '$root/api';
  }

  Future<void> login(String email, String password) async {
    await _request(
      'POST',
      '/auth/admin',
      body: {'correo': email, 'password': password},
    );
  }

  Future<List<MobileProject>> projects() async {
    final data = await _request('GET', '/projects') as Map<String, dynamic>;
    return (data['items'] as List<dynamic>)
        .map((item) => MobileProject.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<MobileDiagramSummary>> diagrams(String projectId) async {
    final data =
        await _request('GET', '/projects/$projectId/diagrams')
            as Map<String, dynamic>;
    return (data['items'] as List<dynamic>)
        .map(
          (item) => MobileDiagramSummary.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  Future<LocalEditorState> loadDiagram(
    String projectId,
    String diagramId,
  ) async {
    final data =
        await _request('GET', '/projects/$projectId/diagrams/$diagramId')
            as Map<String, dynamic>;
    return LocalEditorState(
      diagram: UmlDiagram.fromJson(data['document'] as Map<String, dynamic>),
      projectId: projectId,
      remoteRevision: (data['revision'] as num).toInt(),
      pending: false,
    );
  }

  Future<SyncResult> sync(LocalEditorState local) async {
    final projectId = local.projectId;
    if (projectId == null) {
      throw const ModelaApiException(
        'Selecciona un proyecto antes de sincronizar.',
      );
    }
    final invalid = local.diagram.validate();
    if (invalid != null) throw ModelaApiException(invalid);
    Map<String, dynamic> data;
    if (local.remoteRevision == null) {
      data =
          await _request(
                'POST',
                '/projects/$projectId/diagrams',
                body: local.diagram.toJson(),
              )
              as Map<String, dynamic>;
    } else {
      data =
          await _request(
                'PUT',
                '/projects/$projectId/diagrams/${local.diagram.id}',
                body: {
                  'revision': local.remoteRevision,
                  'document': local.diagram.toJson(),
                },
              )
              as Map<String, dynamic>;
    }
    final saved = LocalEditorState(
      diagram: UmlDiagram.fromJson(data['document'] as Map<String, dynamic>),
      projectId: projectId,
      remoteRevision: (data['revision'] as num).toInt(),
      pending: false,
    );
    return SyncResult(saved, 'Cambios sincronizados con el proyecto.');
  }

  Future<dynamic> _request(String method, String path, {Object? body}) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    try {
      (String, String)? csrf;
      if (body != null && method != 'GET') {
        csrf = await _csrf(client);
      }
      final request = await client.openUrl(method, Uri.parse('$_apiBase$path'));
      request.headers.set(HttpHeaders.acceptHeader, ContentType.json.mimeType);
      final cookie = _cookies.entries
          .map((entry) => '${entry.key}=${entry.value}')
          .join('; ');
      if (cookie.isNotEmpty) {
        request.headers.set(HttpHeaders.cookieHeader, cookie);
      }
      if (body != null) {
        if (csrf != null) request.headers.set(csrf.$1, csrf.$2);
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }
      final response = await request.close();
      _saveCookies(response);
      final text = await utf8.decoder.bind(response).join();
      dynamic data;
      try {
        data = text.isEmpty ? null : jsonDecode(text);
      } on FormatException {
        data = text;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = data is Map<String, dynamic>
            ? (data['message'] as String? ??
                  'El servidor rechazó la operación.')
            : 'El servidor respondió ${response.statusCode}.';
        throw ModelaApiException(message, statusCode: response.statusCode);
      }
      return data;
    } on SocketException {
      throw const ModelaApiException(
        'Sin conexión. El cambio quedó guardado en este dispositivo.',
      );
    } finally {
      client.close(force: true);
    }
  }

  Future<(String, String)> _csrf(HttpClient client) async {
    final request = await client.getUrl(Uri.parse('$_apiBase/auth/csrf'));
    final cookie = _cookies.entries
        .map((entry) => '${entry.key}=${entry.value}')
        .join('; ');
    if (cookie.isNotEmpty) {
      request.headers.set(HttpHeaders.cookieHeader, cookie);
    }
    final response = await request.close();
    _saveCookies(response);
    if (response.statusCode != 200) {
      throw const ModelaApiException(
        'La sesión no es válida. Inicia sesión otra vez.',
      );
    }
    final data =
        jsonDecode(await utf8.decoder.bind(response).join())
            as Map<String, dynamic>;
    return (data['headerName'] as String, data['token'] as String);
  }

  void _saveCookies(HttpClientResponse response) {
    var changed = false;
    for (final cookie in response.cookies) {
      if (_cookies[cookie.name] != cookie.value) {
        _cookies[cookie.name] = cookie.value;
        changed = true;
      }
    }
    // Some test servers expose Set-Cookie only as a raw header.
    for (final value
        in response.headers[HttpHeaders.setCookieHeader] ?? const <String>[]) {
      final pair = value.split(';').first.split('=');
      if (pair.length == 2 && _cookies[pair.first] != pair.last) {
        _cookies[pair.first] = pair.last;
        changed = true;
      }
    }
    if (changed && _cookies.isNotEmpty) onSessionChanged?.call(session);
  }
}
