import { useEffect, useRef, useState } from 'react'

type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> }
type Recognizer = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: SpeechEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void; abort: () => void
}
type RecognizerWindow = Window & { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer }

export function useVoiceInput(visible: boolean, onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const current = useRef<Recognizer | null>(null)
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText }, [onText])
  useEffect(() => {
    const cleanup = () => {
      const active = current.current
      current.current = null
      if (active) { active.onresult = null; active.onerror = null; active.onend = null; active.abort() }
    }
    // Closing the panel also stops capture and clears its status.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    if (!visible) { cleanup(); setListening(false); setMessage('') }
    return cleanup
  }, [visible])
  function toggle() {
    if (current.current) { current.current.stop(); return }
    setMessage('')
    const api = window as RecognizerWindow
    const Constructor = api.SpeechRecognition ?? api.webkitSpeechRecognition
    if (!Constructor) { setMessage('Este navegador no admite dictado. Prueba otro navegador o escribe tu mensaje.'); return }
    try {
      const recognition = new Constructor()
      recognition.lang = 'es-BO'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = event => {
        const pieces: string[] = []
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) pieces.push(event.results[i][0].transcript)
        }
        const text = pieces.join(' ').trim()
        if (text) onTextRef.current(text)
      }
      recognition.onerror = event => {
        setMessage(event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Permite el acceso al micrófono en el navegador para dictar.'
          : event.error === 'no-speech' ? 'No se escuchó ninguna frase. Intenta de nuevo.'
          : event.error === 'network' ? 'El servicio de dictado del navegador no tiene conexión.'
          : event.error === 'aborted' ? '' : 'No se pudo reconocer la voz. Intenta de nuevo.')
      }
      recognition.onend = () => { if (current.current === recognition) current.current = null; setListening(false) }
      current.current = recognition
      setListening(true)
      recognition.start()
    } catch {
      current.current = null; setListening(false); setMessage('No se pudo iniciar el micrófono. Revisa los permisos e inténtalo de nuevo.')
    }
  }
  return { listening, message, toggle }
}
