import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { validateDiagram, type Diagram } from '../domain/model'

interface DraftDatabase extends DBSchema {
  diagrams: { key: string; value: Diagram }
}
export class LocalConflictError extends Error {
  constructor() {
    super(
      'Este borrador cambió en otra pestaña. Recarga para consultar su versión; la operación rechazada no se guardó.',
    )
  }
}
// localRevision protects a local draft. It is NOT the shared server version from CU12.
export class DiagramRepository {
  private database?: Promise<IDBPDatabase<DraftDatabase>>
  private readonly databaseName: string
  constructor(databaseName = 'uml-local-drafts-v1') {
    this.databaseName = databaseName
  }
  private db() {
    return (this.database ??= openDB<DraftDatabase>(this.databaseName, 1, {
      upgrade(db) {
        db.createObjectStore('diagrams', { keyPath: 'id' })
      },
      blocking: () => {
        void this.close()
      },
    }))
  }
  async list(): Promise<Diagram[]> {
    const values = await (await this.db()).getAll('diagrams')
    return values.map(validateDiagram).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  async save(input: Diagram, expectedRevision: number | null): Promise<void> {
    const diagram = validateDiagram(input)
    const tx = (await this.db()).transaction('diagrams', 'readwrite')
    const previous = await tx.store.get(diagram.id)
    if (
      expectedRevision === null
        ? previous !== undefined
        : previous?.localRevision !== expectedRevision
    ) {
      tx.abort()
      await tx.done.catch(() => undefined)
      throw new LocalConflictError()
    }
    if (expectedRevision !== null && diagram.localRevision !== expectedRevision + 1) {
      tx.abort()
      await tx.done.catch(() => undefined)
      throw new Error('La revisión local debe aumentar exactamente en uno.')
    }
    await tx.store.put(diagram)
    await tx.done
  }
  async close() {
    ;(await this.database)?.close()
    this.database = undefined
  }
}
export const diagramRepository = new DiagramRepository()
