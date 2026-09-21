import { expect, it } from 'vitest'
import { generalizationLine } from './generalizationGeometry'

it('conecta la parte superior de la hija con la inferior del padre', () => {
  const result = generalizationLine(
    { x: 0, y: 300, width: 240, height: 100 },
    { x: 150, y: 0, width: 240, height: 100 },
  )
  expect(result.start.y).toBe(300)
  expect(result.end.y).toBe(100)
  expect(result.start.x).toBeLessThan(result.end.x)
})
it('se adapta al mover el padre a la derecha y cambiar su tamaño', () => {
  const result = generalizationLine(
    { x: 0, y: 0, width: 240, height: 100 },
    { x: 400, y: 0, width: 300, height: 100 },
  )
  expect(result.start).toEqual({ x: 240, y: 50 })
  expect(result.end).toEqual({ x: 400, y: 50 })
})
it('apunta al borde superior cuando el padre está debajo', () => {
  const result = generalizationLine(
    { x: 0, y: 0, width: 240, height: 100 },
    { x: 0, y: 300, width: 240, height: 160 },
  )
  expect(result.start).toEqual({ x: 120, y: 100 })
  expect(result.end).toEqual({ x: 120, y: 300 })
})
