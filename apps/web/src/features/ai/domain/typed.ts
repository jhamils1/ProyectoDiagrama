import type { Diagram } from '../../modeling/domain/model'
import { typeAliases } from './dataTypeAliases'

export function typedMessages(instruction: string, diagram: Diagram) {
  return [
    { role: 'system', content: `Traduce la última instrucción UML a JSON con status=propose y operations. Agregar atributo usa type=addAttribute, className, name, dataType y required. Usa el nombre canónico del tipo, nunca su alias. Equivalencias: ${JSON.stringify(typeAliases)}. int siempre se devuelve como Integer. required=false salvo que se pida obligatorio. Conserva nombres exactos, incluidas tildes. No copies atributos existentes ni nombres del ejemplo. No crees clases salvo creación explícita: en ese caso agrega primero addClass con name y abstract=false. /no_think` },
    { role: 'user', content: '{"classes":[{"name":"Persona","attributes":[{"name":"nombre","dataType":"String"}]}],"instruction":"Agrega el atributo edad de tipo int en la clase Persona."}' },
    { role: 'assistant', content: '{"status":"propose","operations":[{"type":"addAttribute","className":"Persona","name":"edad","dataType":"Integer","required":false}]}' },
    { role: 'user', content: JSON.stringify({ classes: diagram.classes.map((c) => ({ name: c.name, attributes: c.attributes.map((a) => ({ name: a.name, dataType: a.dataType })) })), instruction }) },
  ]
}
