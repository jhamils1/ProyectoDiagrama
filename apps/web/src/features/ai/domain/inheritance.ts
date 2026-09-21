import type { Diagram } from '../../modeling/domain/model'

export function inheritanceMessages(instruction: string, diagram: Diagram) {
  return [
    { role: 'system', content: 'Traduce la última instrucción de herencia UML a JSON. A hereda de B significa source=A (hija), target=B (padre), kind=generalization, sourceMultiplicity=1 y targetMultiplicity=1. Copia exactamente los nombres, incluidas tildes y mayúsculas. La clase es solo un prefijo, no parte del nombre. No crees clases. Solo hay autoherencia si ambos nombres son iguales. Responde status=propose y operations con una sola addRelation. /no_think' },
    { role: 'user', content: '{"classes":["Lancha","Embarcacion"],"instruction":"La clase Lancha hereda de Embarcacion"}' },
    { role: 'assistant', content: '{"status":"propose","operations":[{"type":"addRelation","source":"Lancha","target":"Embarcacion","kind":"generalization","sourceMultiplicity":"1","targetMultiplicity":"1"}]}' },
    { role: 'user', content: JSON.stringify({ classes: diagram.classes.map((c) => c.name), instruction }) },
  ]
}
