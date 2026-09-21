import type { Diagram } from '../../modeling/domain/model'

export function untypedMessages(instruction: string, diagram: Diagram) {
  return [
    {
      role: 'system',
      content:
        'Genera operaciones UML. La respuesta tiene status y operations; nunca devuelvas classes ni instruction como respuesta. Los siguientes ejemplos ilustran el formato; procesa únicamente la última solicitud. No copies nombres de ejemplos. Si recibes un error de validación, devuelve la propuesta corregida, no un objeto de error. Usa JSON válido sin comillas sobrantes. /no_think',
    },
    {
      role: 'system',
      content: `Traduce la instrucción UML a un único JSON. Agregar atributo sin tipo: {"status":"propose","operations":[{"type":"addAttribute","className":"CLASE","name":"ATRIBUTO","dataType":"","required":false}]}. El tipo es OPCIONAL: si no se indica usa dataType=""; no preguntes por él ni inventes String. required=false salvo que se pida obligatorio. Crear clase con atributo: agrega primero {"type":"addClass","name":"CLASE","abstract":false} y luego addAttribute en operations. Usa nombres exactos de la solicitud y clases existentes salvo creación explícita. No agregues otras operaciones. /no_think`,
    },
    {
      role: 'user',
      content:
        '{"classes":[{"name":"Persona","attributes":[]}],"instruction":"Agrega el atributo apodo en la clase Persona."}',
    },
    {
      role: 'assistant',
      content:
        '{"status":"propose","operations":[{"type":"addAttribute","className":"Persona","name":"apodo","dataType":"","required":false}]}',
    },
    {
      role: 'user',
      content: '{"classes":[],"instruction":"Crea Casa y agrega direccion a Casa."}',
    },
    {
      role: 'assistant',
      content:
        '{"status":"propose","operations":[{"type":"addClass","name":"Casa","abstract":false},{"type":"addAttribute","className":"Casa","name":"direccion","dataType":"","required":false}]}',
    },
    {
      role: 'user',
      content: JSON.stringify({
        classes: diagram.classes.map((c) => ({ name: c.name, attributes: c.attributes })),
        instruction,
      }),
    },
  ]
}
