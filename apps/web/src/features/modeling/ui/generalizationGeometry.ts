type Rect = { x: number; y: number; width: number; height: number }
export function generalizationLine(child: Rect, parent: Rect) {
  const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
  const a = center(child),
    b = center(parent)
  const border = (r: Rect, from: typeof a, to: typeof a) => {
    const dx = to.x - from.x,
      dy = to.y - from.y
    const scale = Math.max(Math.abs(dx) / (r.width / 2), Math.abs(dy) / (r.height / 2))
    return scale ? { x: from.x + dx / scale, y: from.y + dy / scale } : from
  }
  return { start: border(child, a, b), end: border(parent, b, a) }
}
