import { BaseEdge, type EdgeProps } from '@xyflow/react'

type Point = { x: number; y: number }

/** Dashed UML link from an association's midpoint to its association class. */
export function AssociationClassEdge({ id, data, style }: EdgeProps) {
  const { start, end } = data as { start: Point; end: Point }
  return <BaseEdge id={id} path={`M ${start.x},${start.y} L ${end.x},${end.y}`} style={style} />
}
