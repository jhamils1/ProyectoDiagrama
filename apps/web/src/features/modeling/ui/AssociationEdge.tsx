import { BaseEdge, EdgeText, type EdgeProps } from '@xyflow/react'
import type { generalizationLine } from './generalizationGeometry'

export function AssociationEdge({
  id,
  data,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const { start, end, sourceMultiplicity, targetMultiplicity } = data as ReturnType<
    typeof generalizationLine
  > & { sourceMultiplicity: string; targetMultiplicity: string }
  const dx = end.x - start.x,
    dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const inset = Math.min(20, length / 4)
  const ux = dx / length,
    uy = dy / length
  const labels = {
    labelStyle,
    labelBgStyle,
    labelBgPadding: [3, 2] as [number, number],
    labelBgBorderRadius: 3,
  }
  return (
    <>
      <BaseEdge
        id={id}
        path={`M ${start.x},${start.y} L ${end.x},${end.y}`}
        style={style}
        label={label}
        labelX={(start.x + end.x) / 2}
        labelY={(start.y + end.y) / 2}
        labelStyle={labelStyle}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
      />
      <EdgeText
        {...labels}
        label={sourceMultiplicity}
        x={start.x + ux * inset - uy * 13}
        y={start.y + uy * inset + ux * 13}
      />
      <EdgeText
        {...labels}
        label={targetMultiplicity}
        x={end.x - ux * inset - uy * 13}
        y={end.y - uy * inset + ux * 13}
      />
    </>
  )
}
