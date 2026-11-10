import type { ImageModel } from './imageDiagram'

export type Raster = { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
export type TextRegion = { text: string; box: number[] }
export type Rect = { left: number; top: number; right: number; bottom: number }
type Segment = { start: number; end: number; at: number; weight: number }

function inkMask(image: Raster) {
  const mask = new Uint8Array(image.width * image.height)
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4,
      r = image.data[p],
      g = image.data[p + 1],
      b = image.data[p + 2]
    mask[i] = Math.max(r, g, b) < 160 || (b > r * 1.2 && r < 155 && g < 155) ? 1 : 0
  }
  return mask
}
function segments(mask: Uint8Array, width: number, height: number, vertical: boolean) {
  const major = vertical ? height : width,
    minor = vertical ? width : height
  const minimum = Math.max(45, major * 0.065),
    groups: Segment[] = []
  for (let at = 0; at < minor; at++) {
    let start = -1,
      last = -1,
      count = 0
    const finish = () => {
      if (start < 0 || last - start < minimum || count / (last - start + 1) < 0.72) return
      const group = groups.find(
        (s) =>
          Math.abs(s.at - at) < 12 &&
          Math.min(s.end, last) - Math.max(s.start, start) >
            Math.min(s.end - s.start, last - start) * 0.65,
      )
      if (group) {
        group.at = (group.at * group.weight + at) / (group.weight + 1)
        group.weight++
        group.start = Math.min(group.start, start)
        group.end = Math.max(group.end, last)
      } else groups.push({ start, end: last, at, weight: 1 })
    }
    for (let pos = 0; pos < major; pos++) {
      const ink = mask[vertical ? pos * width + at : at * width + pos]
      if (ink) {
        if (start < 0) start = pos
        last = pos
        count++
      } else if (start >= 0 && pos - last > 5) {
        finish()
        start = -1
        count = 0
      }
    }
    finish()
  }
  return groups
}
export function detectClassBoxes(image: Raster): Rect[] {
  const mask = inkMask(image),
    horizontal = segments(mask, image.width, image.height, false),
    vertical = segments(mask, image.width, image.height, true)
  const tolerance = Math.max(15, image.width * 0.018),
    candidates: Rect[] = []
  for (const a of horizontal)
    for (const b of horizontal) {
      if (
        b.at - a.at < 60 ||
        Math.abs(a.start - b.start) > tolerance ||
        Math.abs(a.end - b.end) > tolerance
      )
        continue
      const left = (a.start + b.start) / 2,
        right = (a.end + b.end) / 2
      const side = (x: number) =>
        vertical.some(
          (v) =>
            Math.abs(v.at - x) < tolerance &&
            v.start < a.at + tolerance &&
            v.end > b.at - tolerance,
        )
      if (!side(left) || !side(right)) continue
      // Class compartments have a name header separated from the attributes.
      if (
        !horizontal.some(
          (h) =>
            h.at > a.at + 15 &&
            h.at < b.at - 15 &&
            Math.abs(h.start - left) < tolerance &&
            Math.abs(h.end - right) < tolerance,
        )
      )
        continue
      candidates.push({ left, right, top: a.at, bottom: b.at })
    }
  return candidates
    .filter(
      (b, i) =>
        !candidates.some(
          (a, j) =>
            i !== j &&
            a.left <= b.left + tolerance &&
            a.right >= b.right - tolerance &&
            a.top <= b.top &&
            a.bottom >= b.bottom &&
            a.bottom - a.top > b.bottom - b.top + 10,
        ),
    )
    .sort((a, b) => (Math.abs(a.top - b.top) < 20 ? a.left - b.left : a.top - b.top))
}
function regionRect(region: TextRegion): Rect {
  const xs = region.box.filter((_, i) => i % 2 === 0),
    ys = region.box.filter((_, i) => i % 2 === 1)
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  }
}
function inside(region: TextRegion, box: Rect) {
  const r = regionRect(region),
    x = (r.left + r.right) / 2,
    y = (r.top + r.bottom) / 2
  return x > box.left && x < box.right && y > box.top && y < box.bottom
}
function multiplicity(text: string) {
  const normalized = text.replace(/\s/g, '').replace(/(?<=\d)\.(?=[*\d]$)/, '..')
  return /^(?:\*|[01]|[01]\.\.(?:1|\*))$/.test(normalized) ? normalized : null
}
export function reconstructImageModel(
  image: Raster,
  regions: TextRegion[],
): { model: ImageModel; boxes: Rect[]; warnings: string[] } {
  const boxes = detectClassBoxes(image),
    warnings: string[] = []
  const entries = boxes
    .map((box) => {
      const own = regions
        .filter((r) => inside(r, box))
        .sort((a, b) => regionRect(a).top - regionRect(b).top)
      const name = own
        .find((r) => !r.text.includes(':') && !multiplicity(r.text))
        ?.text.replace(/^[+\-#~]\s*/, '')
        .trim()
      const attributes = own
        .filter((r) => r.text.includes(':'))
        .map((r) => {
          const [name, ...type] = r.text.split(':')
          return { name: name.replace(/^[+\-#~]\s*/, '').trim(), type: type.join(':').trim() }
        })
      return name ? { box, name, attributes } : null
    })
    .filter((e) => e !== null)
  if (!entries.length)
    throw new Error(
      'No se reconocieron cajas de clases con nombre. Usa una foto frontal y nítida, con los bordes completos.',
    )
  if (entries.length !== boxes.length) warnings.push('Hay cajas cuyo nombre no pudo leerse.')
  const mask = inkMask(image),
    relations: ImageModel['relations'] = []
  const outside = regions.filter((r) => !entries.some((e) => inside(r, e.box)))
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i],
        b = entries[j]
      const horizontal =
        a.box.right < b.box.left &&
        Math.min(a.box.bottom, b.box.bottom) > Math.max(a.box.top, b.box.top)
      const vertical =
        a.box.bottom < b.box.top &&
        Math.min(a.box.right, b.box.right) > Math.max(a.box.left, b.box.left)
      if (!horizontal && !vertical) continue
      const begin = horizontal ? a.box.right : a.box.bottom,
        end = horizontal ? b.box.left : b.box.top
      const low = Math.ceil(
        horizontal ? Math.max(a.box.top, b.box.top) : Math.max(a.box.left, b.box.left),
      )
      const high = Math.floor(
        horizontal ? Math.min(a.box.bottom, b.box.bottom) : Math.min(a.box.right, b.box.right),
      )
      let best = 0,
        axis = 0
      for (let at = low + 8; at < high - 8; at++) {
        let covered = 0,
          total = 0
        for (let p = Math.ceil(begin) + 5; p < end - 5; p++) {
          total++
          let ink = false
          for (let d = -5; d <= 5; d++)
            if (mask[horizontal ? (at + d) * image.width + p : p * image.width + at + d]) {
              ink = true
              break
            }
          if (ink) covered++
        }
        if (total > 10 && covered / total > best) {
          best = covered / total
          axis = at
        }
      }
      if (best < 0.84) continue
      const near = outside
        .map((r) => ({ text: multiplicity(r.text), r: regionRect(r) }))
        .filter((e) => e.text)
        .map((e) => ({
          text: e.text!,
          x: (e.r.left + e.r.right) / 2,
          y: (e.r.top + e.r.bottom) / 2,
        }))
        .filter((e) =>
          horizontal
            ? e.x > begin - 10 && e.x < end + 10 && Math.abs(e.y - axis) < 85
            : e.y > begin - 10 && e.y < end + 10 && Math.abs(e.x - axis) < 85,
        )
      const endpoint = (start: boolean) =>
        near
          .filter((e) => (horizontal ? e.x : e.y) < (begin + end) / 2 === start)
          .sort(
            (x, y) =>
              Math.abs((horizontal ? x.x : x.y) - (start ? begin : end)) -
              Math.abs((horizontal ? y.x : y.y) - (start ? begin : end)),
          )[0]?.text ?? ''
      const sourceMultiplicity = endpoint(true),
        targetMultiplicity = endpoint(false)
      relations.push({
        source: a.name,
        target: b.name,
        type: 'association',
        sourceMultiplicity,
        targetMultiplicity,
      })
      if (!sourceMultiplicity || !targetMultiplicity)
        warnings.push(`Completa la multiplicidad de ${a.name}–${b.name}.`)
    }
  warnings.push(
    'Revisa las conexiones: esta versión detecta asociaciones rectas horizontales y verticales; la herencia y las líneas diagonales se completan en la vista previa.',
  )
  return {
    model: { classes: entries.map(({ name, attributes }) => ({ name, attributes })), relations },
    boxes: entries.map((e) => e.box),
    warnings,
  }
}
