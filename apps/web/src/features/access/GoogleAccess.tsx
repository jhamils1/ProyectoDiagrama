import { useEffect, useRef, useState } from 'react'
import { api, errorMessage, type User } from '../../shared/api'

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        nonce: string
        auto_select: boolean
        callback: (response: { credential: string }) => void
      }) => void
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}
declare global {
  interface Window {
    google?: GoogleIdentity
  }
}
let scriptPromise: Promise<void> | null = null
function loadGoogle() {
  if (window.google) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      scriptPromise = null
      reject(new Error('No se pudo cargar Google. Comprueba la conexión.'))
    }
    document.head.append(script)
  })
  return scriptPromise
}
export function GoogleAccess({ onSuccess }: { onSuccess: (user: User) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const [intent, setIntent] = useState<'LOGIN' | 'REGISTER'>('LOGIN')
  const [message, setMessage] = useState('Preparando acceso con Google…')
  const [retry, setRetry] = useState(0)
  const [canRetry, setCanRetry] = useState(false)
  const [busy, setBusy] = useState(false)
  const success = useRef(onSuccess)
  useEffect(() => {
    success.current = onSuccess
  }, [onSuccess])
  useEffect(() => {
    let canceled = false
    async function prepare() {
      try {
        const config = await api<{ googleEnabled: boolean; googleClientId: string }>('/auth/config')
        if (canceled) return
        if (!config.googleEnabled) {
          setMessage('El acceso con Google estará disponible cuando se configure el cliente OAuth.')
          return
        }
        const { nonce } = await api<{ nonce: string }>('/auth/google/challenge')
        await loadGoogle()
        if (canceled || !container.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          nonce,
          auto_select: false,
          callback: (response) => {
            if (canceled) return
            setBusy(true)
            api<User>('/auth/google', {
              method: 'POST',
              body: JSON.stringify({ credential: response.credential, intent }),
            })
              .then((user) => {
                if (!canceled) success.current(user)
              })
              .catch((error) => {
                if (!canceled) {
                  setMessage(errorMessage(error))
                  setCanRetry(true)
                  container.current?.replaceChildren()
                }
              })
              .finally(() => {
                if (!canceled) setBusy(false)
              })
          },
        })
        container.current.replaceChildren()
        window.google.accounts.id.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: intent === 'REGISTER' ? 'signup_with' : 'signin_with',
          locale: 'es',
          width: 300,
        })
        setMessage(
          'Usaremos tu identidad de Google. Tus proyectos dependen de los permisos asignados.',
        )
      } catch (error) {
        if (!canceled) {
          setMessage(errorMessage(error))
          setCanRetry(true)
        }
      }
    }
    void prepare()
    return () => {
      canceled = true
    }
  }, [intent, retry])
  return (
    <div className="google-access">
      <div className="auth-intents">
        <button
          className={intent === 'LOGIN' ? 'chosen' : ''}
          onClick={() => {
            setIntent('LOGIN')
            setCanRetry(false)
          }}
        >
          Acceder
        </button>
        <button
          className={intent === 'REGISTER' ? 'chosen' : ''}
          onClick={() => {
            setIntent('REGISTER')
            setCanRetry(false)
          }}
        >
          Registrarme
        </button>
      </div>
      <div ref={container} className={busy ? 'google-busy' : ''} />
      <p className="auth-hint" role="status">
        {busy ? 'Verificando identidad…' : message}
      </p>
      {canRetry && (
        <button
          className="secondary"
          onClick={() => {
            setCanRetry(false)
            setRetry((n) => n + 1)
          }}
        >
          Reintentar Google
        </button>
      )}
    </div>
  )
}
