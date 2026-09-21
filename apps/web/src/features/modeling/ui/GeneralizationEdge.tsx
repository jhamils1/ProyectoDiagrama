import { BaseEdge, type EdgeProps } from '@xyflow/react'

import type { generalizationLine } from './generalizationGeometry'

export function GeneralizationEdge({
  id,
  data,
  markerEnd,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const { start, end } = data as ReturnType<typeof generalizationLine>
  return (
    <BaseEdge
      id={id}
      path={`M ${start.x},${start.y} L ${end.x},${end.y}`}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={(start.x + end.x) / 2}
      labelY={(start.y + end.y) / 2}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  )
}
