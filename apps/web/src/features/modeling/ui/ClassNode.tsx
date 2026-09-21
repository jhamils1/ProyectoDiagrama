import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { KeyRound } from 'lucide-react'
import { visibilitySymbols, type UmlClass } from '../domain/model'

export type ClassFlowNode = Node<{ uml: UmlClass }, 'umlClass'>
export function ClassNode({ data, selected }: NodeProps<ClassFlowNode>) {
  const c = data.uml
  return (
    <div className={`class-node ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="class-heading">
        <strong className={c.abstract ? 'abstract' : ''}>{c.name}</strong>
      </div>
      <div className="class-attributes">
        {c.attributes.length === 0 ? (
          <p className="node-empty">Sin atributos</p>
        ) : (
          c.attributes.map((a) => (
            <div key={a.id} className="node-attribute">
              <span className="visibility">{visibilitySymbols[a.visibility]}</span>
              <span>{a.name}</span>
              <span className="attribute-type">
                {a.dataType ? `: ${a.dataType}` : ' · sin tipo'}
              </span>
              {a.identifier && <KeyRound size={12} aria-label="Identificador" />}
            </div>
          ))
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
