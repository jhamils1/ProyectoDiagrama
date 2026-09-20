import { useState } from 'react'
import { ArrowLeft, ArrowRight, GitBranch, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import { api, errorMessage, type User } from '../../shared/api'
import { GoogleAccess } from './GoogleAccess'

export function LoginPage({
  onSuccess,
  initialError,
}: {
  onSuccess: (user: User) => void
  initialError?: string
}) {
  const [mode, setMode] = useState<'google' | 'admin'>('google')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError ?? '')
  return (
    <main className="login-page">
      <section className="login-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <GitBranch size={23} />
          </span>
          <span>
            modela<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="login-story-content">
          <span className="eyebrow">UN ESPACIO COMPARTIDO PARA TUS IDEAS</span>
          <h1>
            De una idea
            <br />a un modelo.
            <br />
            <em>En equipo.</em>
          </h1>
          <p>Organiza tus proyectos y reúne a tus colaboradores con los permisos que necesitan.</p>
          <div className="story-card">
            <Users size={22} />
            <div>
              <strong>Cada proyecto, su equipo</strong>
              <span>Acceso de consulta o edición, asignado por el Administrador.</span>
            </div>
          </div>
        </div>
        <span className="story-footer">Ingeniería de Software 1 · Primera entrega incremental</span>
      </section>
      <section className="login-form-section">
        <a href="/" className="back-link">
          <ArrowLeft size={15} />
          Volver al editor local
        </a>
        <div className="login-card">
          <span className="login-symbol">
            <LockKeyhole size={23} />
          </span>
          <span className="eyebrow">BIENVENIDO A MODELA</span>
          <h2>Accede a tu espacio</h2>
          <p className="login-description">Elige el método de acceso de tu cuenta.</p>
          <div className="access-tabs">
            <button
              className={mode === 'google' ? 'chosen' : ''}
              onClick={() => {
                setMode('google')
                setError('')
              }}
            >
              <Users size={15} />
              Colaborador
            </button>
            <button
              className={mode === 'admin' ? 'chosen' : ''}
              onClick={() => {
                setMode('admin')
                setError('')
              }}
            >
              <ShieldCheck size={15} />
              Administrador
            </button>
          </div>
          {mode === 'google' ? (
            <GoogleAccess onSuccess={onSuccess} />
          ) : (
            <form
              className="admin-login"
              onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true)
                setError('')
                const data = new FormData(event.currentTarget)
                try {
                  onSuccess(
                    await api<User>('/auth/admin', {
                      method: 'POST',
                      body: JSON.stringify({
                        correo: data.get('correo'),
                        password: data.get('password'),
                      }),
                    }),
                  )
                } catch (error) {
                  setError(errorMessage(error))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <label>
                Correo del Administrador
                <input
                  name="correo"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="tu@correo.com"
                  maxLength={254}
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  maxLength={72}
                  placeholder="Tu contraseña"
                />
              </label>
              <button className="primary large full" disabled={busy}>
                {busy ? 'Verificando…' : 'Iniciar sesión'}
                <ArrowRight size={16} />
              </button>
              <p className="auth-hint">
                La cuenta del Administrador se configura al instalar el sistema.
              </p>
            </form>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="login-local-note">
            <span>¿Quieres seguir modelando sin conexión?</span>
            <a href="/">
              Abrir mis borradores locales <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
