import { openDB, type DBSchema } from 'idb'
import type { User, Project } from '../../../shared/api'
import {
  applyCommand,
  createDiagram,
  validateDiagram,
  type Diagram,
  type ModelCommand,
} from '../domain/model'
import type { DiagramEnvelope, ProposalResponse } from '../application/useProjectEditor'

const DAY = 24 * 60 * 60 * 1000
export type LocalSession = {
  user: User
  until: number
  locked: boolean
  logoutPending: boolean
  epoch: string
}
export type ProjectCopy = {
  creation?: boolean
  syncError?: string
  key: string
  userId: string
  project: Project
  base: DiagramEnvelope
  document: Diagram
  until: number
  counter: number
  denied: boolean
  pending: { id: string; baseRevision: number; document: Diagram; attempted: boolean } | null
  conflict: ProposalResponse | null
}
export type OfflineProject = {
  key: string
  userId: string
  project: Project
  until: number
  denied: boolean
}
interface CopyDatabase extends DBSchema {
  session: { key: string; value: LocalSession }
  copies: { key: string; value: ProjectCopy }
  projects: { key: string; value: OfflineProject }
}
export const copyKey = (user: string, project: string, diagram: string) =>
  `${user}/${project}/${diagram}`
export class ProjectCopies {
  private database
  constructor(name = 'modela-project-copies-v1') {
    let blocked = false
    let rejectBlocked: (reason: Error) => void = () => {}
    const blockedUpgrade = new Promise<never>((_, reject) => {
      rejectBlocked = reject
    })
    const opening = openDB<CopyDatabase>(name, 2, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore('session')
          db.createObjectStore('copies', { keyPath: 'key' })
        }
        const projects = db.createObjectStore('projects', { keyPath: 'key' })
        for (const copy of await tx.objectStore('copies').getAll()) {
          const key = `${copy.userId}/${copy.project.id}`
          const old = await projects.get(key)
          if (!old || copy.until > old.until)
            await projects.put({
              key,
              userId: copy.userId,
              project: copy.project,
              until: copy.until,
              denied: copy.denied,
            })
        }
      },
      blocking: () => {
        void this.close()
      },
      blocked: () => {
        blocked = true
        rejectBlocked(
          new Error(
            'Cierra las otras pestañas de Modela y recarga para actualizar las copias locales sin borrarlas.',
          ),
        )
      },
    })
    void opening.then(
      (db) => {
        if (blocked) db.close()
      },
      () => {},
    )
    this.database = Promise.race([opening, blockedUpgrade])
  }
  async session() {
    return (await this.database).get('session', 'active')
  }
  async remember(user: User) {
    await (
      await this.database
    ).put(
      'session',
      {
        user,
        until: Date.now() + DAY,
        locked: false,
        logoutPending: false,
        epoch: crypto.randomUUID(),
      },
      'active',
    )
  }
  async confirm(user: User, expectedEpoch: string | undefined) {
    const tx = (await this.database).transaction('session', 'readwrite')
    const session = await tx.store.get('active')
    if (session?.epoch !== expectedEpoch)
      throw new Error('La sesión cambió durante la comprobación. Vuelve a iniciar sesión.')
    await tx.store.put(
      {
        user,
        until: Date.now() + DAY,
        locked: false,
        logoutPending: false,
        epoch:
          session && !session.locked && session.user.id === user.id
            ? session.epoch
            : crypto.randomUUID(),
      },
      'active',
    )
    await tx.done
  }
  async refresh(user: User) {
    const tx = (await this.database).transaction('session', 'readwrite')
    const session = await tx.store.get('active')
    if (!session || session.locked || session.user.id !== user.id)
      throw new Error('La cuenta se bloqueó mientras se comprobaba la conexión.')
    await tx.store.put({ ...session, user, until: Date.now() + DAY }, 'active')
    await tx.done
  }
  async lock(logoutPending = false) {
    const tx = (await this.database).transaction('session', 'readwrite')
    const session = await tx.store.get('active')
    if (session)
      await tx.store.put(
        {
          ...session,
          locked: true,
          logoutPending: session.logoutPending || logoutPending,
          epoch: crypto.randomUUID(),
        },
        'active',
      )
    await tx.done
  }
  async logoutCompleted() {
    const tx = (await this.database).transaction('session', 'readwrite')
    const session = await tx.store.get('active')
    if (session) await tx.store.put({ ...session, locked: true, logoutPending: false }, 'active')
    await tx.done
  }
  private check(session: LocalSession | undefined, userId: string) {
    if (!session || session.locked || session.user.id !== userId || session.until <= Date.now())
      throw new Error('Acceso local bloqueado. Inicia sesión con conexión usando la misma cuenta.')
  }
  async list(userId: string) {
    const tx = (await this.database).transaction(['session', 'copies'])
    this.check(await tx.objectStore('session').get('active'), userId)
    return (await tx.objectStore('copies').getAll()).filter((c) => c.userId === userId)
  }
  async find(userId: string, projectId: string, diagramId: string) {
    const tx = (await this.database).transaction(['session', 'copies'])
    this.check(await tx.objectStore('session').get('active'), userId)
    const copy = await tx.objectStore('copies').get(copyKey(userId, projectId, diagramId))
    if (!copy)
      throw new Error('Este diagrama todavía no está preparado para trabajar sin conexión.')
    validateDiagram(copy.document)
    return copy
  }
  async get(userId: string, projectId: string, diagramId: string) {
    const copy = await this.find(userId, projectId, diagramId)
    if (copy.denied || copy.until <= Date.now())
      throw new Error(
        'Conecta para volver a comprobar el permiso de esta copia. Tus pendientes se conservan.',
      )
    validateDiagram(copy.document)
    return copy
  }
  async prepare(userId: string, project: Project, base: DiagramEnvelope) {
    validateDiagram(base.document)
    const tx = (await this.database).transaction(['session', 'copies', 'projects'], 'readwrite')
    this.check(await tx.objectStore('session').get('active'), userId)
    await tx.objectStore('projects').put({
      key: `${userId}/${project.id}`,
      userId,
      project,
      until: Date.now() + DAY,
      denied: false,
    })
    const key = copyKey(userId, project.id, base.document.id)
    const old = await tx.objectStore('copies').get(key)
    const copy: ProjectCopy = old
      ? {
          ...old,
          project,
          until: Date.now() + DAY,
          denied: false,
          base: old.pending || old.conflict ? { ...old.base, permiso: base.permiso } : base,
          document: old.pending || old.conflict ? old.document : base.document,
          counter:
            old.counter +
            (old.denied ||
            old.base.permiso !== base.permiso ||
            (!old.pending && !old.conflict && JSON.stringify(old.base) !== JSON.stringify(base))
              ? 1
              : 0),
        }
      : {
          key,
          userId,
          project,
          base,
          document: base.document,
          until: Date.now() + DAY,
          counter: 0,
          denied: false,
          pending: null,
          conflict: null,
        }
    await tx.objectStore('copies').put(copy)
    await tx.done
    return copy
  }
  async prepareProject(userId: string, project: Project) {
    const tx = (await this.database).transaction(['session', 'projects'], 'readwrite')
    this.check(await tx.objectStore('session').get('active'), userId)
    await tx.objectStore('projects').put({
      key: `${userId}/${project.id}`,
      userId,
      project,
      until: Date.now() + DAY,
      denied: false,
    })
    await tx.done
  }
  async projects(userId: string) {
    const tx = (await this.database).transaction(['session', 'projects'])
    this.check(await tx.objectStore('session').get('active'), userId)
    return (await tx.objectStore('projects').getAll()).filter((p) => p.userId === userId)
  }
  async create(userId: string, projectId: string, name: string) {
    const document = createDiagram(name)
    const tx = (await this.database).transaction(['session', 'projects', 'copies'], 'readwrite')
    this.check(await tx.objectStore('session').get('active'), userId)
    const cached = await tx.objectStore('projects').get(`${userId}/${projectId}`)
    if (
      !cached ||
      cached.denied ||
      cached.until <= Date.now() ||
      cached.project.permiso === 'CONSULTA'
    )
      throw new Error(
        'Prepara el proyecto con conexión y permiso de edición antes de crear diagramas offline.',
      )
    const copy: ProjectCopy = {
      key: copyKey(userId, projectId, document.id),
      userId,
      project: cached.project,
      base: { document, revision: 0, versionActual: 0, permiso: cached.project.permiso },
      document,
      until: cached.until,
      denied: false,
      counter: 0,
      creation: true,
      conflict: null,
      pending: { id: crypto.randomUUID(), baseRevision: 0, document, attempted: false },
    }
    await tx.objectStore('copies').add(copy)
    await tx.done
    return copy
  }
  async authorizeCreation(key: string, project: Project) {
    return this.update(key, (old) => ({
      ...old,
      project,
      until: Date.now() + DAY,
      denied: false,
      base: { ...old.base, permiso: project.permiso },
      counter: old.counter + (old.denied || old.base.permiso !== project.permiso ? 1 : 0),
    }))
  }
  private async update(key: string, change: (copy: ProjectCopy) => ProjectCopy) {
    const tx = (await this.database).transaction(['session', 'copies'], 'readwrite')
    const old = await tx.objectStore('copies').get(key)
    if (!old) throw new Error('La copia local ya no está disponible.')
    this.check(await tx.objectStore('session').get('active'), old.userId)
    const next = change(old)
    await tx.objectStore('copies').put(next)
    await tx.done
    return next
  }
  async edit(copy: ProjectCopy, command: ModelCommand) {
    return this.update(copy.key, (old) => {
      if (old.counter !== copy.counter)
        throw new Error(
          'Otra pestaña modificó esta copia. Actualiza antes de guardar; tus campos siguen abiertos.',
        )
      if (old.denied || old.until <= Date.now() || old.base.permiso === 'CONSULTA')
        throw new Error('No hay permiso local de edición vigente.')
      if (old.pending?.attempted || old.conflict)
        throw new Error('Resuelve o sincroniza la propuesta pendiente antes de seguir editando.')
      const document = applyCommand(old.document, command)
      return {
        ...old,
        document,
        counter: old.counter + 1,
        pending: {
          id: old.pending?.id ?? crypto.randomUUID(),
          baseRevision: old.base.revision,
          document,
          attempted: false,
        },
      }
    })
  }
  async freeze(key: string) {
    return this.update(key, (old) => {
      if (old.denied || old.until <= Date.now() || old.base.permiso === 'CONSULTA')
        throw new Error('La propuesta necesita permiso de edición vigente.')
      return old.pending
        ? { ...old, counter: old.counter + 1, pending: { ...old.pending, attempted: true } }
        : old
    })
  }
  async acknowledge(key: string, result: ProposalResponse) {
    validateDiagram(result.current.document)
    return this.update(key, (old) => {
      if (old.pending?.id !== result.id && old.conflict?.id !== result.id) return old
      return {
        ...old,
        base: result.current,
        document: result.current.document,
        pending: null,
        creation: false,
        syncError: undefined,
        conflict: result.status === 'PENDIENTE' ? result : null,
        counter: old.counter + 1,
      }
    })
  }
  async deny(key: string) {
    return this.update(key, (old) => ({ ...old, denied: true, counter: old.counter + 1 }))
  }
  async failure(key: string, message: string) {
    return this.update(key, (old) => ({ ...old, syncError: message }))
  }
  async clearFailure(key: string) {
    return this.update(key, (old) => ({ ...old, syncError: undefined }))
  }
  async denyProject(userId: string, projectId: string) {
    const tx = (await this.database).transaction(['session', 'projects'], 'readwrite')
    this.check(await tx.objectStore('session').get('active'), userId)
    const p = await tx.objectStore('projects').get(`${userId}/${projectId}`)
    if (p) await tx.objectStore('projects').put({ ...p, denied: true })
    await tx.done
  }
  async close() {
    ;(await this.database.catch(() => undefined))?.close()
  }
}
// Lazy: importing this module must not open IndexedDB in non-browser test environments.
let repository: ProjectCopies | undefined
export const projectCopies = () => (repository ??= new ProjectCopies())
