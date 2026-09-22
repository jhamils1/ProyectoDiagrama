package com.example.modela_consumer

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Build
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val CHANNEL = "bo.edu.modela/local_voice"
        private const val RECORD_AUDIO_REQUEST = 4201
    }

    private var pendingVoiceResult: MethodChannel.Result? = null
    private var recognizer: SpeechRecognizer? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "startOfflineSpeech") startOfflineSpeech(result) else result.notImplemented()
        }
    }

    private fun startOfflineSpeech(result: MethodChannel.Result) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            result.error("UNAVAILABLE", "El reconocimiento de voz no está disponible en este dispositivo.", null)
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingVoiceResult = result
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), RECORD_AUDIO_REQUEST)
            return
        }
        listen(result)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != RECORD_AUDIO_REQUEST) return
        val result = pendingVoiceResult
        pendingVoiceResult = null
        if (result == null) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) listen(result)
        else result.error("PERMISSION", "Se necesita permiso de micrófono para dictar una instrucción.", null)
    }

    private fun listen(result: MethodChannel.Result) {
        recognizer?.destroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
            result.error(
                "OFFLINE_UNAVAILABLE",
                "Este teléfono no expone un reconocedor de voz local para aplicaciones. Actualiza Speech Services by Google o activa el reconocimiento sin conexión.",
                null,
            )
            return
        }
        recognizer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        } else {
            SpeechRecognizer.createSpeechRecognizer(this)
        }.apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) = Unit
                override fun onBeginningOfSpeech() = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() = Unit
                override fun onPartialResults(partialResults: Bundle?) = Unit
                override fun onEvent(eventType: Int, params: Bundle?) = Unit
                override fun onError(error: Int) {
                    result.error("VOICE_$error", speechErrorMessage(error), null)
                    recognizer?.destroy()
                    recognizer = null
                }
                override fun onResults(results: Bundle?) {
                    val values = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val transcript = values?.firstOrNull()
                    if (transcript.isNullOrBlank()) result.error("EMPTY", "No se reconoció una instrucción.", null)
                    else result.success(transcript)
                    recognizer?.destroy()
                    recognizer = null
                }
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                // Match the exact local language pack selected on the phone,
                // for example es-BO when Spanish (Bolivia) is downloaded.
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            }
            startListening(intent)
        }
    }

    private fun speechErrorMessage(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_NO_MATCH -> "No se entendió la instrucción. Habla de nuevo, por ejemplo: crear clase Factura."
        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED,
        SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "El reconocedor local no tiene disponible español. Descarga el idioma en Speech Services by Google."
        SpeechRecognizer.ERROR_NETWORK,
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "El servicio intentó usar red. Verifica que el reconocimiento sin conexión esté instalado."
        else -> "No fue posible reconocer la instrucción local (código $error)."
    }

    override fun onDestroy() {
        recognizer?.destroy()
        recognizer = null
        super.onDestroy()
    }
}
