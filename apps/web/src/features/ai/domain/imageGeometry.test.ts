import { describe, expect, it } from 'vitest'
import { reconstructImageModel, type TextRegion } from './imageGeometry'

function fixture(connection = true) {
  const width = 800,
    height = 460,
    data = new Uint8ClampedArray(width * height * 4).fill(255)
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const count = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
    for (let n = 0; n <= count; n++)
      for (let d = -1; d <= 1; d++) {
        const x = Math.round(x1 + ((x2 - x1) * n) / count),
          y = Math.round(y1 + ((y2 - y1) * n) / count) + d,
          p = (y * width + x) * 4
        data[p] = 15
        data[p + 1] = 15
        data[p + 2] = 100
      }
  }
  for (const [x, y] of [
    [40, 40],
    [480, 40],
    [480, 270],
  ]) {
    line(x, y, x + 230, y)
    line(x, y + 50, x + 230, y + 50)
    line(x, y + 155, x + 230, y + 155)
    line(x, y, x, y + 155)
    line(x + 230, y, x + 230, y + 155)
  }
  if (connection) {
    line(270, 120, 480, 120)
    line(590, 195, 590, 270)
  }
  const region = (text: string, x: number, y: number): TextRegion => ({
    text,
    box: [x, y, x + 80, y, x + 80, y + 20, x, y + 20],
  })
  const regions = [
    region('Persona', 90, 55),
    region('id: Long', 65, 110),
    region('Vehiculo', 530, 55),
    region('placa: String', 505, 110),
    region('Motor', 530, 285),
    region('potencia: Integer', 505, 345),
    region('1', 285, 100),
    region('0.*', 380, 100),
    region('1', 600, 205),
    region('0..1', 600, 240),
  ]
  return { image: { width, height, data }, regions }
}
describe('reconstrucción geométrica del texto reconocido por IA', () => {
  it('reconstruye nombres variables, atributos y ambas conexiones de la foto', () => {
    const { image, regions } = fixture(),
      { model } = reconstructImageModel(image, regions)
    expect(model.classes.map((c) => c.name)).toEqual(['Persona', 'Vehiculo', 'Motor'])
    expect(model.classes[1].attributes).toEqual([{ name: 'placa', type: 'String' }])
    expect(model.relations).toEqual([
      {
        source: 'Persona',
        target: 'Vehiculo',
        type: 'association',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
      {
        source: 'Vehiculo',
        target: 'Motor',
        type: 'association',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..1',
      },
    ])
  })
  it('no inventa conexiones por cercanía entre clases', () => {
    const { image, regions } = fixture(false)
    expect(reconstructImageModel(image, regions).model.relations).toHaveLength(0)
  })
  it('deja la multiplicidad ilegible vacía para su revisión', () => {
    const { image, regions } = fixture()
    const { model, warnings } = reconstructImageModel(
      image,
      regions.filter((r) => r.text !== '0.*'),
    )
    expect(model.relations[0].targetMultiplicity).toBe('')
    expect(warnings.some((w) => w.includes('Persona–Vehiculo'))).toBe(true)
  })
})
