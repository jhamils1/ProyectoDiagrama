import { describe, expect, it } from 'vitest'
import { labDiagram, corpus } from './corpus'
import { holdout } from './holdout'
import { holdout6c } from './holdout6c'
import { messagesFor, parseProposal, previewProposal } from './proposal'

describe('Propuestas de IA aisladas del editor', () => {
  it('simula una creación compuesta sin modificar el original y asigna UUID válidos', () => {
    const base = labDiagram()
    const before = JSON.stringify(base)
    const result = previewProposal(
      base,
      parseProposal(
        JSON.stringify({
          status: 'propose',
          operations: [
            { type: 'addClass', name: 'Factura' },
            { type: 'addAttribute', className: 'Factura', name: 'total', dataType: 'Decimal' },
          ],
        }),
      ),
    )
    expect(result.classes.at(-1)?.attributes[0].name).toBe('total')
    expect(JSON.stringify(base)).toBe(before)
  })
  it('rechaza todo el lote cuando una operación viola las reglas', () => {
    const base = labDiagram()
    expect(() =>
      previewProposal(
        base,
        parseProposal(
          '{"status":"propose","operations":[{"type":"addClass","name":"Factura"},{"type":"addClass","name":"Cliente"}]}',
        ),
      ),
    ).toThrow()
    expect(base.classes.some((c) => c.name === 'Factura')).toBe(false)
  })
  it.each([
    '```json\n{}\n```',
    '{"status":"propose","operations":[]}',
    '{"status":"propose","operations":[{"type":"eval","code":"alert(1)"}]}',
    '{"status":"clarify","message":"?","code":"bad"}',
  ])('rechaza salida fuera del contrato: %s', (raw) => {
    expect(() => parseProposal(raw)).toThrow()
  })
  it('rechaza referencias inexistentes y ciclos por el dominio compartido', () => {
    const base = labDiagram()
    expect(() =>
      previewProposal(
        base,
        parseProposal(
          '{"status":"propose","operations":[{"type":"deleteClass","name":"NoExiste"}]}',
        ),
      ),
    ).toThrow()
    expect(() =>
      previewProposal(
        base,
        parseProposal(
          '{"status":"propose","operations":[{"type":"addRelation","source":"Persona","target":"Persona","kind":"generalization"}]}',
        ),
      ),
    ).toThrow()
  })
  it('valida previamente los 20 resultados positivos y las 30 instrucciones del corpus', () => {
    expect(corpus).toHaveLength(30)
    for (const item of corpus) {
      expect(messagesFor(item.instruction, labDiagram()).at(-1)?.content).toContain(
        item.instruction,
      )
      const expected = item.expected
      if (expected !== 'no-proposal')
        expect(() =>
          previewProposal(labDiagram(), { status: 'propose', operations: expected }),
        ).not.toThrow()
    }
  })
  it('valida los resultados positivos de la suite reservada en su propio contexto', () => {
    expect(holdout).toHaveLength(20)
    for (const item of holdout) {
      const expected = item.expected
      if (expected !== 'no-proposal')
        expect(() =>
          previewProposal(labDiagram(item.classNames), { status: 'propose', operations: expected }),
        ).not.toThrow()
    }
  })
  it('valida los 20 casos definidos antes de medir 6C y usa su contexto', () => {
    expect(holdout6c).toHaveLength(20)
    for (const item of holdout6c) {
      const base = labDiagram(item.classNames)
      expect(messagesFor(item.instruction, base).at(-1)?.content).toContain('Paciente')
      const expected = item.expected
      if (expected !== 'no-proposal')
        expect(() =>
          previewProposal(base, { status: 'propose', operations: expected }),
        ).not.toThrow()
    }
  })
  it('limita entrada y salida y conserva el modelo cuando se pide aclaración', () => {
    expect(() => messagesFor(' ', labDiagram())).toThrow()
    expect(() => messagesFor('a'.repeat(1501), labDiagram())).toThrow()
    expect(() => parseProposal('a'.repeat(16001))).toThrow()
    const base = labDiagram()
    expect(previewProposal(base, { status: 'clarify', reason: 'missing_class' })).toEqual(base)
  })
})
