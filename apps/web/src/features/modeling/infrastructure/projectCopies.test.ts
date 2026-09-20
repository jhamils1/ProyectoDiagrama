import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, expect, it, vi } from 'vitest'
import { ProjectCopies } from './projectCopies'
import { createDiagram } from '../domain/model'
import type { Project, User } from '../../../shared/api'
import type { ProposalResponse } from '../application/useProjectEditor'

const stores: ProjectCopies[] = []
it('informa si una pestaña antigua bloquea la migración sin borrar la base', async () => {
  const name = crypto.randomUUID()
  const legacy = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('session')
      db.createObjectStore('copies', { keyPath: 'key' })
    },
  })
  const r = repo(name)
  await expect(r.session()).rejects.toThrow('Cierra las otras pestañas')
  legacy.close()
})
it('prepara un proyecto vacío y recupera un diagrama creado offline con sus ediciones', async () => {
  const name = crypto.randomUUID(),
    r = repo(name)
  await r.remember(user)
  await expect(r.create(user.id, project.id, 'Sin preparar')).rejects.toThrow('Prepara')
  await r.prepareProject(user.id, project)
  const copy = await r.create(user.id, project.id, 'Nuevo offline')
  const changed = await r.edit(copy, { type: 'renameDiagram', name: 'Editado offline' })
  expect(changed.pending?.id).toBe(copy.pending?.id)
  expect(changed.creation).toBe(true)
  await r.close()
  const recovered = await repo(name).get(user.id, project.id, copy.document.id)
  expect(recovered.document.name).toBe('Editado offline')
  expect(recovered.base.versionActual).toBe(0)
})
it('una creación congelada mantiene su cuerpo hasta confirmarse y luego permite nuevas ediciones', async () => {
  const { r } = await prepared()
  const copy = await r.create(user.id, project.id, 'Nuevo')
  const frozen = await r.freeze(copy.key)
  await expect(r.edit(frozen, { type: 'renameDiagram', name: 'Otro' })).rejects.toThrow(
    'sincroniza',
  )
  const current = { document: copy.document, revision: 2, versionActual: 3, permiso: 'EDICION' }
  const confirmed = await r.acknowledge(copy.key, {
    id: copy.pending!.id,
    status: 'APLICADO',
    baseRevision: 0,
    comparedRevision: 2,
    proposed: copy.document,
    current,
    conflicts: [],
  })
  expect(confirmed.creation).toBe(false)
  const edited = await r.edit(confirmed, { type: 'renameDiagram', name: 'Posterior' })
  expect(edited.pending?.baseRevision).toBe(2)
  expect(edited.pending?.id).not.toBe(copy.pending?.id)
})
it('la creación local exige cuenta, permiso vigente y modelo válido', async () => {
  const { r } = await prepared()
  await expect(r.create(user.id, project.id, '')).rejects.toThrow()
  await r.prepareProject(user.id, { ...project, permiso: 'CONSULTA' })
  await expect(r.create(user.id, project.id, 'Consulta')).rejects.toThrow('permiso')
  await r.prepareProject(user.id, project)
  await r.denyProject(user.id, project.id)
  await expect(r.create(user.id, project.id, 'Revocado')).rejects.toThrow('Prepara')
  await r.prepareProject(user.id, project)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000)
  await r.remember(user)
  await expect(r.create(user.id, project.id, 'Caducado')).rejects.toThrow('Prepara')
  await r.remember({ ...user, id: crypto.randomUUID() })
  await expect(r.create(user.id, project.id, 'Ajeno')).rejects.toThrow('bloqueado')
})
it('la migración de IndexedDB 1 a 2 conserva copias pendientes y prepara sus proyectos', async () => {
  const name = crypto.randomUUID(),
    doc = createDiagram('Anterior')
  const legacy = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('session')
      db.createObjectStore('copies', { keyPath: 'key' })
    },
  })
  const copy = {
    key: `${user.id}/${project.id}/${doc.id}`,
    userId: user.id,
    project,
    document: doc,
    base: { document: doc, revision: 0, versionActual: 1, permiso: 'ADMINISTRACION' },
    until: Date.now() + 60000,
    denied: false,
    counter: 1,
    conflict: null,
    pending: { id: crypto.randomUUID(), baseRevision: 0, document: doc, attempted: true },
  }
  await legacy.put(
    'session',
    {
      user,
      until: Date.now() + 60000,
      locked: false,
      logoutPending: false,
      epoch: crypto.randomUUID(),
    },
    'active',
  )
  await legacy.put('copies', copy)
  legacy.close()
  const r = repo(name)
  expect((await r.get(user.id, project.id, doc.id)).pending).toEqual(copy.pending)
  expect((await r.projects(user.id))[0].project).toEqual(project)
  expect((await r.create(user.id, project.id, 'Después de migrar')).creation).toBe(true)
})
const repo = (name = crypto.randomUUID()) => {
  const r = new ProjectCopies(name)
  stores.push(r)
  return r
}
const user: User = {
  id: crypto.randomUUID(),
  nombre: 'Uno',
  correo: 'uno@test.local',
  rol: 'ADMINISTRADOR',
  activo: true,
  googleVinculado: false,
  revision: 0,
}
const project: Project = {
  id: crypto.randomUUID(),
  nombre: 'Prueba',
  descripcion: '',
  permiso: 'ADMINISTRACION',
  fechaCreacion: new Date().toISOString(),
  revision: 0,
}
const base = () => ({
  document: createDiagram(),
  revision: 0,
  versionActual: 1,
  permiso: 'ADMINISTRACION',
})
afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(stores.splice(0).map((r) => r.close()))
})
async function prepared(r = repo()) {
  await r.remember(user)
  return { r, copy: await r.prepare(user.id, project, base()) }
}

it('conserva cambios y versión base tras cerrar IndexedDB; agrupa solo propuestas nunca enviadas', async () => {
  const name = crypto.randomUUID(),
    first = repo(name),
    { copy } = await prepared(first)
  const a = await first.edit(copy, { type: 'renameDiagram', name: 'Primero' })
  const b = await first.edit(a, { type: 'renameDiagram', name: 'Segundo' })
  expect(b.pending?.id).toBe(a.pending?.id)
  expect(b.pending?.baseRevision).toBe(0)
  await first.close()
  expect((await repo(name).get(user.id, project.id, copy.document.id)).document.name).toBe(
    'Segundo',
  )
})
it('rechaza la segunda escritura simultánea de dos pestañas sin sobrescribir', async () => {
  const { r, copy } = await prepared()
  const results = await Promise.allSettled(
    ['Uno', 'Dos'].map((name) => r.edit(copy, { type: 'renameDiagram', name })),
  )
  expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1)
})
it('congela un envío ambiguo: cuerpo y UUID idénticos en reintentos, sin admitir nuevas ediciones', async () => {
  const { r, copy } = await prepared()
  const changed = await r.edit(copy, { type: 'renameDiagram', name: 'Pendiente' })
  const frozen = await r.freeze(copy.key)
  await expect(r.edit(frozen, { type: 'renameDiagram', name: 'Otro' })).rejects.toThrow(
    'sincroniza',
  )
  expect((await r.freeze(copy.key)).pending).toEqual(frozen.pending)
  expect(frozen.pending?.id).toBe(changed.pending?.id)
})
it('otra cuenta y el cierre local no pueden leer o modificar pendientes; la misma cuenta los recupera', async () => {
  const { r, copy } = await prepared()
  await r.edit(copy, { type: 'renameDiagram', name: 'Privado' })
  await r.lock(true)
  await expect(r.get(user.id, project.id, copy.document.id)).rejects.toThrow('bloqueado')
  await expect(r.refresh(user)).rejects.toThrow('bloqueó')
  expect((await r.session())?.logoutPending).toBe(true)
  const other = { ...user, id: crypto.randomUUID() }
  await r.remember(other)
  expect(await r.list(other.id)).toEqual([])
  await expect(r.freeze(copy.key)).rejects.toThrow('bloqueado')
  await r.remember(user)
  expect((await r.get(user.id, project.id, copy.document.id)).pending?.document.name).toBe(
    'Privado',
  )
})
it('la caducidad de cuenta o permiso bloquea offline sin eliminar los cambios', async () => {
  const { r, copy } = await prepared()
  await r.edit(copy, { type: 'renameDiagram', name: 'Conservado' })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000)
  await expect(r.get(user.id, project.id, copy.document.id)).rejects.toThrow('bloqueado')
  await r.remember(user)
  await expect(r.get(user.id, project.id, copy.document.id)).rejects.toThrow('permiso')
  await r.prepare(user.id, project, copy.base)
  expect((await r.get(user.id, project.id, copy.document.id)).document.name).toBe('Conservado')
})
it('una comprobación de identidad iniciada antes del logout no vuelve a desbloquear la cuenta', async () => {
  const { r } = await prepared()
  const before = await r.session()
  await r.lock(true)
  await expect(r.confirm(user, before?.epoch)).rejects.toThrow('sesión cambió')
  expect((await r.session())?.locked).toBe(true)
  expect((await r.session())?.logoutPending).toBe(true)
})
it('revocación y consulta impiden envío pero conservan la propuesta', async () => {
  const { r, copy } = await prepared()
  await r.edit(copy, { type: 'renameDiagram', name: 'Conservado' })
  await r.deny(copy.key)
  await expect(r.get(user.id, project.id, copy.document.id)).rejects.toThrow('permiso')
  const restored = await r.prepare(user.id, project, { ...copy.base, permiso: 'CONSULTA' })
  await expect(r.freeze(copy.key)).rejects.toThrow('permiso')
  expect(restored.pending?.document.name).toBe('Conservado')
})
it('una confirmación antigua no borra una nueva propuesta y un conflicto sobrevive a la recarga', async () => {
  const { r, copy } = await prepared()
  const changed = await r.edit(copy, { type: 'renameDiagram', name: 'Local' })
  const result: ProposalResponse = {
    id: changed.pending!.id,
    status: 'PENDIENTE',
    baseRevision: 0,
    comparedRevision: 1,
    proposed: changed.document,
    conflicts: [],
    current: { ...copy.base, revision: 1 },
  }
  const conflict = await r.acknowledge(copy.key, result)
  expect(conflict.pending).toBeNull()
  expect((await r.get(user.id, project.id, copy.document.id)).conflict?.proposed.name).toBe('Local')
  const applied = await r.acknowledge(copy.key, { ...result, status: 'APLICADO' })
  const next = await r.edit(applied, { type: 'renameDiagram', name: 'Nuevo' })
  expect((await r.acknowledge(copy.key, result)).pending?.id).toBe(next.pending?.id)
})
