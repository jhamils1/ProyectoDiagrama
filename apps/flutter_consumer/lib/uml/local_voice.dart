import 'package:flutter/services.dart';

class LocalVoiceException implements Exception {
  const LocalVoiceException(this.message);
  final String message;
  @override
  String toString() => message;
}

class LocalVoice {
  static const _channel = MethodChannel('bo.edu.modela/local_voice');

  /// Uses Android's recognizer with EXTRA_PREFER_OFFLINE enabled.
  Future<String> transcribe() async {
    try {
      final value = await _channel.invokeMethod<String>('startOfflineSpeech');
      if (value == null || value.trim().isEmpty) {
        throw const LocalVoiceException('No se reconoció una instrucción.');
      }
      return value.trim();
    } on PlatformException catch (error) {
      throw LocalVoiceException(
        error.message ?? 'No se pudo iniciar el reconocimiento local.',
      );
    }
  }
}
