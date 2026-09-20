import { api, ApiError, errorMessage, type User, type Project } from '../../../shared/api'
import type { DiagramEnvelope, ProposalResponse } from './useProjectEditor'
import { copyKey, projectCopies, type ProjectCopy } from '../infrastructure/projectCopies'

export const unavailable = (e: unknown) =>
  e instanceof ApiError && (e.status === 0 || e.status >= 500)
export async function verifyAccount(): Promise<User> {
  const store = projectCopies()
  let session = await store.session()
  if (session?.logoutPending) {
    await api('/auth/logout', { method: 'POST' })
    await store.logoutCompleted()
    session = await store.session()
  }
  try {
    const user = await api<User>('/auth/me')
    await store.confirm(user, session?.epoch)
    return user
  } catch (e) {
    if (e instanceof ApiError && [401, 403].includes(e.status)) await store.lock()
    throw e
  }
}
const inFlight = new Map<string, Promise<ProjectCopy>>()
export function synchronizeCopy(userId: string, projectId: string, diagramId: string) {
  const key = copyKey(userId, projectId, diagramId)
  const old = inFlight.get(key)
  if (old) return old
  const task = sendCopy(userId, projectId, diagramId)
    .catch(async (e) => {
      const store = projectCopies()
      if (e instanceof ApiError && e.status === 401) await store.lock()
      if (e instanceof ApiError && [403, 404].includes(e.status))
        await store.deny(key).catch(() => {})
      await store
        .failure(key, e instanceof ApiError && e.status === 0 ? '' : errorMessage(e))
        .catch(() => {})
      throw e
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, task)
  return task
}
async function sendCopy(userId: string, projectId: string, diagramId: string) {
  const store = projectCopies()
  // Never authenticate or unlock an account as a side effect of background synchronization.
  const session = await store.session()
  if (!session || session.locked || session.user.id !== userId)
    throw new Error('Inicia sesión para sincronizar tus pendientes.')
  const path = `/projects/${projectId}/diagrams/${diagramId}`
  const user = await api<User>('/auth/me')
  if (user.id !== userId) {
    await store.lock()
    throw new Error('Cambió la cuenta de la sesión. Vuelve al espacio de trabajo.')
  }
  await store.refresh(user)
  const project = await api<Project>(`/projects/${projectId}`).catch(async (e) => {
    if (e instanceof ApiError && [403, 404].includes(e.status))
      await store.denyProject(userId, projectId)
    throw e
  })
  await store.prepareProject(userId, project)
  let copy = await store.find(userId, projectId, diagramId)
  const creation = !!copy.creation
  if (creation) copy = await store.authorizeCreation(copy.key, project)
  else copy = await store.prepare(userId, project, await api<DiagramEnvelope>(path))
  if (copy.pending) {
    if (copy.base.permiso === 'CONSULTA')
      throw new ApiError(
        403,
        'SIN_EDICION',
        'Tus cambios se conservan, pero necesitas recuperar el permiso de edición para enviarlos.',
      )
    copy = await store.freeze(copy.key)
    // Another tab may have acknowledged the previous proposal before this transaction acquired
    // its lock. Always use the operation and body that were actually frozen together.
    if (!copy.pending) return store.clearFailure(copy.key)
    const result = await api<ProposalResponse>(`${path}/changes${copy.creation ? '/create' : ''}`, {
      method: 'POST',
      body: JSON.stringify({
        id: copy.pending!.id,
        ...(!copy.creation ? { baseRevision: copy.pending!.baseRevision } : {}),
        document: copy.pending!.document,
        authorId: userId,
      }),
    })
    copy = await store.acknowledge(copy.key, result)
  } else if (copy.conflict) {
    copy = await store.acknowledge(
      copy.key,
      await api<ProposalResponse>(`${path}/changes/${copy.conflict.id}`),
    )
  }
  return store.clearFailure(copy.key)
}
