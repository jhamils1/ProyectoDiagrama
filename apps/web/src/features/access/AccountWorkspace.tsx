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
import { ProjectDiagrams } from '../projects/ProjectDiagrams'
import { ProjectCopiesPanel } from '../projects/ProjectCopiesPanel'
import { OfflineProjectEditor } from '../modeling/ui/OfflineProjectEditor'
import { projectCopies } from '../modeling/infrastructure/projectCopies'
import { unavailable, verifyAccount } from '../modeling/application/syncProjectCopy'
import { useProjectSynchronization } from '../modeling/application/useProjectSynchronization'
import { copyKey } from '../modeling/infrastructure/projectCopies'
import './access.css'

export default function AccountWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [view, setView] = useState<'projects' | 'users' | 'copies'>(
      new URLSearchParams(location.search).has('copies') ? 'copies' : 'projects',
    )
  const [offline, setOffline] = useState(false)
  const [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0)
  const route = new URLSearchParams(window.location.search)
  const projectId = route.get('project'),
    diagramId = route.get('diagram')
  const synchronization = useProjectSynchronization(
    user?.id,
    user && projectId && diagramId && (route.has('offline') || offline)
      ? copyKey(user.id, projectId, diagramId)
      : null,
  )
  useEffect(() => {
    if (!user) return
    let canceled = false
    const timer = setInterval(() => {
      void projectCopies()
        .session()
        .then((session) => {
          if (!canceled && session && (session.locked || session.user.id !== user.id)) {
            setUser(null)
            setError('La sesión local se cerró o cambió de cuenta. Inicia sesión para continuar.')
          }
        })
        .catch(() => {})
    }, 1000)
    return () => {
      canceled = true
      clearInterval(timer)
    }
  }, [user])
  useEffect(() => {
    let canceled = false
    verifyAccount()
      .then((u) => {
        if (!canceled) {
          setUser(u)
          setOffline(false)
        }
      })
      .catch(async (e) => {
        if (!canceled) {
          if (unavailable(e)) {
            const session = await projectCopies()
              .session()
              .catch(() => undefined)
            if (canceled) return
            if (session && !session.locked && session.until > Date.now()) {
              setUser(session.user)
              setOffline(true)
              setView('copies')
              return
            }
          }
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
    void projectCopies()
      .remember(u)
      .catch((e) => setError(errorMessage(e)))
    setUser(u)
    setOffline(false)
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
  if (projectId && diagramId && (route.has('offline') || offline))
    return <OfflineProjectEditor userId={user.id} projectId={projectId} diagramId={diagramId} />
  if (projectId && !offline)
    return <ProjectDiagrams userId={user.id} projectId={projectId} diagramId={diagramId} />
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
            disabled={offline}
            className={view === 'projects' ? 'active' : ''}
            onClick={() => {
              setView('projects')
              setError('')
            }}
          >
            <Folder size={17} />
            Proyectos
          </button>
          <button className={view === 'copies' ? 'active' : ''} onClick={() => setView('copies')}>
            <Folder size={17} /> Copias sin conexión
          </button>
          {user.rol === 'ADMINISTRADOR' && !offline && (
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
                await projectCopies().lock(true)
                setUser(null)
                await api('/auth/logout', { method: 'POST' })
                await projectCopies().logoutCompleted()
                setError('')
              } catch (e) {
                setError(
                  unavailable(e)
                    ? 'Sesión local cerrada. Los pendientes se conservan. La sesión del servidor se cerrará al reconectar.'
                    : errorMessage(e),
                )
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
            Modela · Diagramas de proyecto
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
        {view === 'copies' || offline ? (
          <ProjectCopiesPanel userId={user.id} synchronization={synchronization} />
        ) : view === 'users' && user.rol === 'ADMINISTRADOR' ? (
          <UsersPanel report={report} />
        ) : (
          <ProjectsPanel admin={user.rol === 'ADMINISTRADOR'} report={report} />
        )}
      </main>
    </div>
  )
}
