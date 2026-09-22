import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'modela_api_client.dart';

/// Stores only the opaque server session, never the user's password.
class LocalSessionStore {
  static const _key = 'modela.mobile.session.v1';
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<ModelaSession?> load() async {
    final value = await _storage.read(key: _key);
    if (value == null) return null;
    try {
      return ModelaSession.fromJson(jsonDecode(value) as Map<String, dynamic>);
    } on Object {
      await clear();
      return null;
    }
  }

  Future<void> save(ModelaSession session) =>
      _storage.write(key: _key, value: jsonEncode(session.toJson()));

  Future<void> clear() => _storage.delete(key: _key);
}
