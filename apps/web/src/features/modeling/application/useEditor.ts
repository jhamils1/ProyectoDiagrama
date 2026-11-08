import { useEffect, useRef, useState } from 'react'
import { applyCommand, createDiagram, type Diagram, type ModelCommand } from '../domain/model'
import { diagramRepository } from '../infrastructure/diagramRepository'

export function useEditor() {
  const [diagrams, setDiagrams] = useState<Diagram[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const busy = useRef(false)
  const active = diagrams.find((d) => d.id === activeId) ?? null
  useEffect(() => {
    let mounted = true
    diagramRepository
      .list()
      .then((items) => {
        if (mounted) {
          setDiagrams(items)
          setActiveId(items[0]?.id ?? null)
        }
      })
      .catch(() => {
        if (mounted) {
          setLoadFailed(true)
          setError(
            'No se pudieron leer los borradores. Los datos existentes no se reemplazaron. Comprueba el almacenamiento del navegador y recarga.',
          )
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])
  async function persist(next: Diagram, previous: Diagram | null) {
    if (busy.current || loadFailed) return false
    busy.current = true
    setSaving(true)
    setError(null)
    try {
      await diagramRepository.save(next, previous?.localRevision ?? null)
      setDiagrams((items) => [next, ...items.filter((d) => d.id !== next.id)])
      setActiveId(next.id)
      return true
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo guardar. Comprueba el espacio disponible y vuelve a intentarlo.',
      )
      return false
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  async function execute(command: ModelCommand, _assistantInstruction?: string) {
    if (!active || busy.current) return false
    try {
      return await persist(applyCommand(active, command), active)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operación inválida.')
      return false
    }
  }
  async function newDiagram() {
    return persist(createDiagram(`Diagrama ${diagrams.length + 1}`), null)
  }
  return {
    diagrams,
    active,
    loading,
    saving,
    error,
    loadFailed,
    execute,
    newDiagram,
    selectDiagram: (id: string) => {
      if (!busy.current) {
        setActiveId(id)
        setError(null)
      }
    },
    dismissError: () => setError(null),
  }
}
