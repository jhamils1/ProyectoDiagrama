import { useCallback, useEffect, useState } from 'react'
import {
  GitBranch,
  Folder,
  Users,
  LogOut,
  ArrowUpRight,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react'
import { api, ApiError, errorMessage, type User } from '../../shared/api'
import { LoginPage } from './LoginPage'
import { ProjectsPanel } from '../projects/ProjectsPanel'
import { UsersPanel } from '../projects/UsersPanel'
import './access.css'

export default function AccountWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [view, setView] = useState<'projects' | 'users'>('projects')
  const [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0)
  useEffect(() => {
    let canceled = false
    api<User>('/auth/me')
      .then((u) => {
        if (!canceled) setUser(u)
      })
      .catch((e) => {
        if (!canceled) {
          if (e instanceof ApiError && e.status === 401) setUser(null)
          else setError(errorMessage(e))
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [reload])
  const report = useCallback((e: unknown) => {
    setError(errorMessage(e))
    if (e instanceof ApiError && e.status === 401) setUser(null)
  }, [])
  const success = (u: User) => {
    setUser(u)
    setError('')
    setView('projects')
  }
  if (loading)
    return (
      <div className="account-loading">
        <RefreshCw className="spin" />
        Comprobando sesión…
      </div>
    )
  if (!user) return <LoginPage key={error} onSuccess={success} initialError={error} />
  return (
    <div className="app-shell account-shell">
      <aside className="sidebar">
        <a className="brand" href="/workspace">
          <span className="brand-mark">
            <GitBranch size={23} />
          </span>
          <span>
            modela<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">{user.nombre.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.nombre}</strong>
            <span>{user.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Colaborador'}</span>
          </div>
        </div>
        <div className="sidebar-section">ESPACIO COMPARTIDO</div>
        <nav className="account-nav">
          <button
            className={view === 'projects' ? 'active' : ''}
            onClick={() => {
              setView('projects')
              setError('')
            }}
          >
            <Folder size={17} />
            Proyectos
          </button>
          {user.rol === 'ADMINISTRADOR' && (
            <button
              className={view === 'users' ? 'active' : ''}
              onClick={() => {
                setView('users')
                setError('')
              }}
            >
              <Users size={17} />
              Usuarios
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <a className="account-local-link" href="/">
            Editor local
            <ArrowUpRight size={15} />
          </a>
          <button
            className="logout-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await api('/auth/logout', { method: 'POST' })
                setUser(null)
                setError('')
              } catch (e) {
                report(e)
              } finally {
                setBusy(false)
              }
            }}
          >
            <LogOut size={16} />
            {busy ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
          <div className="sidebar-foot">
            <span className="status-dot" />
            Modela · Segunda etapa
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Folder size={16} />
            <strong>Mi espacio de trabajo</strong>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button"
              aria-label="Actualizar sesión y datos"
              onClick={() => {
                setLoading(true)
                setReload((n) => n + 1)
              }}
            >
              <RefreshCw size={15} />
            </button>
            <span className="version-badge">
              {user.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Colaborador'}
            </span>
            <span className="user-avatar">{user.nombre.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button className="icon-button" aria-label="Cerrar aviso" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {view === 'users' && user.rol === 'ADMINISTRADOR' ? (
          <UsersPanel report={report} />
        ) : (
          <ProjectsPanel admin={user.rol === 'ADMINISTRADOR'} report={report} />
        )}
      </main>
    </div>
  )
}
