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
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { api, ApiError, errorMessage, type PageResult, type Project, type User } from '../../shared/api'
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
  const [projectsOpen, setProjectsOpen] = useState(() =>
    new URLSearchParams(window.location.search).has('project'),
  )
  const [sidebarProjects, setSidebarProjects] = useState<Project[]>([])
  const [sidebarProjectsLoading, setSidebarProjectsLoading] = useState(false)
  const [projectsVersion, setProjectsVersion] = useState(0)
  const [locationSearch, setLocationSearch] = useState(() => window.location.search)
  const route = new URLSearchParams(locationSearch)
  const projectId = route.get('project'),
    diagramId = route.get('diagram')
  const navigate = useCallback((href: string) => {
    window.history.pushState({}, '', href)
    setLocationSearch(window.location.search)
  }, [])
  const synchronization = useProjectSynchronization(
    user?.id,
    user && projectId && diagramId
      ? copyKey(user.id, projectId, diagramId)
      : null,
  )
  const report = useCallback((e: unknown) => {
    setError(errorMessage(e))
    if (e instanceof ApiError && e.status === 401) setUser(null)
  }, [])
  useEffect(() => {
    const updateRoute = () => setLocationSearch(window.location.search)
    window.addEventListener('popstate', updateRoute)
    return () => window.removeEventListener('popstate', updateRoute)
  }, [])
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
  useEffect(() => {
    if (!user || offline) {
      setSidebarProjects([])
      return
    }
    let canceled = false
    setSidebarProjectsLoading(true)
    api<PageResult<Project>>('/projects?page=0&size=100')
      .then((data) => {
        if (!canceled) setSidebarProjects(data.items)
      })
      .catch((e) => {
        if (!canceled) report(e)
      })
      .finally(() => {
        if (!canceled) setSidebarProjectsLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [user, offline, projectsVersion, report])
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
    return <OfflineProjectEditor userId={user.id} currentUser={user} projectId={projectId} diagramId={diagramId} />
  if (projectId && diagramId && !offline)
    return <ProjectDiagrams userId={user.id} currentUser={user} projectId={projectId} diagramId={diagramId} />
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
          <div className="account-project-menu">
            <button
              disabled={offline}
              className={view === 'projects' ? 'active' : ''}
              onClick={() => {
                setView('projects')
                if (projectId) {
                  navigate('/workspace')
                  return
                }
                setProjectsOpen((open) => !open)
                setError('')
              }}
              aria-expanded={projectsOpen}
              aria-controls="project-submenu"
            >
              <Folder size={17} />
              <span>Proyectos</span>
              <ChevronDown className={projectsOpen ? 'project-chevron open' : 'project-chevron'} size={16} />
            </button>
            {projectsOpen && !offline && (
              <div id="project-submenu" className="project-submenu">
                {sidebarProjectsLoading ? (
                  <span>Cargando proyectos…</span>
                ) : sidebarProjects.length === 0 ? (
                  <span>Sin proyectos disponibles.</span>
                ) : (
                  sidebarProjects.map((project) => (
                    <a
                      key={project.id}
                      href={`/workspace?project=${project.id}`}
                      onClick={(event) => {
                        event.preventDefault()
                        setView('projects')
                        navigate(`/workspace?project=${project.id}`)
                      }}
                    >
                      <span>{project.nombre}</span>
                      <ChevronRight size={14} />
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className={view === 'copies' ? 'active' : ''}
            onClick={() => {
              setView('copies')
              navigate('/workspace?copies=1')
            }}
          >
            <Folder size={17} /> Copias sin conexión
          </button>
          {user.rol === 'ADMINISTRADOR' && !offline && (
            <button
              className={view === 'users' ? 'active' : ''}
              onClick={() => {
                setView('users')
                navigate('/workspace')
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
      {projectId && !offline ? (
        <ProjectDiagrams userId={user.id} projectId={projectId} diagramId={null} />
      ) : (
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
          <ProjectsPanel
            admin={user.rol === 'ADMINISTRADOR'}
            report={report}
            onProjectsChanged={() => setProjectsVersion((version) => version + 1)}
          />
        )}
        </main>
      )}
    </div>
  )
}
