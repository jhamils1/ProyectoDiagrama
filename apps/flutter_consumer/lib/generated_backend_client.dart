import 'dart:convert';
import 'dart:io';

class GeneratedBackendException implements Exception {
  const GeneratedBackendException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// HTTP client for the predictable CRUD endpoints produced by Modela's ZIP.
class GeneratedBackendClient {
  GeneratedBackendClient(this.baseUrl);

  final String baseUrl;

  static String normalizeBaseUrl(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw const FormatException(
        'Escribe una URL completa, por ejemplo http://127.0.0.1:8081.',
      );
    }
    return uri
        .replace(path: uri.path.replaceFirst(RegExp(r'/+$'), ''))
        .toString();
  }

  Uri endpoint(String resource, [String? id]) {
    final normalizedResource = resource.trim().replaceAll(
      RegExp(r'^/+|/+$'),
      '',
    );
    if (normalizedResource.isEmpty ||
        !RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(normalizedResource)) {
      throw const FormatException(
        'El recurso solo puede contener letras, números, guiones o guion bajo.',
      );
    }
    final suffix = id == null || id.trim().isEmpty
        ? normalizedResource
        : '$normalizedResource/${id.trim()}';
    return Uri.parse('${normalizeBaseUrl(baseUrl)}/$suffix');
  }

  Future<dynamic> list(String resource) => _request('GET', endpoint(resource));

  Future<dynamic> get(String resource, String id) {
    if (id.trim().isEmpty) {
      throw const FormatException('Escribe el identificador a consultar.');
    }
    return _request('GET', endpoint(resource, id));
  }

  Future<dynamic> create(String resource, Object body) =>
      _request('POST', endpoint(resource), body: body);

  Future<dynamic> update(String resource, String id, Object body) {
    if (id.trim().isEmpty) {
      throw const FormatException('Escribe el identificador a actualizar.');
    }
    return _request('PUT', endpoint(resource, id), body: body);
  }

  Future<dynamic> delete(String resource, String id) {
    if (id.trim().isEmpty) {
      throw const FormatException('Escribe el identificador a eliminar.');
    }
    return _request('DELETE', endpoint(resource, id));
  }

  Future<dynamic> _request(String method, Uri endpoint, {Object? body}) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    try {
      final request = await client
          .openUrl(method, endpoint)
          .timeout(const Duration(seconds: 10));
      request.headers.contentType = ContentType.json;
      request.headers.set(HttpHeaders.acceptHeader, ContentType.json.mimeType);
      if (body != null) request.write(jsonEncode(body));
      final response = await request.close().timeout(
        const Duration(seconds: 20),
      );
      final text = await utf8.decoder.bind(response).join();
      if (response.statusCode == HttpStatus.noContent) return null;
      dynamic payload;
      try {
        payload = text.isEmpty ? null : jsonDecode(text);
      } on FormatException {
        payload = text;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = payload is Map && payload['message'] is String
            ? payload['message'] as String
            : text;
        throw GeneratedBackendException(
          message.isEmpty
              ? 'El backend respondió ${response.statusCode}.'
              : message,
          statusCode: response.statusCode,
        );
      }
      return payload;
    } on SocketException {
      throw const GeneratedBackendException(
        'No se pudo conectar con el backend. Revisa la URL y que esté iniciado.',
      );
    } on HttpException catch (error) {
      throw GeneratedBackendException(error.message);
    } finally {
      client.close(force: true);
    }
  }
}
