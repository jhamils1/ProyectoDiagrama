import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export function Modal({
  title,
  children,
  close,
}: {
  title: string
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="modal account-modal" onCancel={close} aria-labelledby={titleId}>
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Cerrar formulario">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Pagination({
  page,
  size,
  total,
  change,
  busy,
}: {
  page: number
  size: number
  total: number
  change: (page: number) => void
  busy?: boolean
}) {
  return (
    <div className="pagination">
      <span>
        {total === 0
          ? '0 resultados'
          : `${page * size + 1}–${Math.min((page + 1) * size, total)} de ${total}`}
      </span>
      <button
        type="button"
        className="icon-button"
        aria-label="Página anterior"
        disabled={page === 0 || busy}
        onClick={() => change(page - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Página siguiente"
        disabled={(page + 1) * size >= total || busy}
        onClick={() => change(page + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
