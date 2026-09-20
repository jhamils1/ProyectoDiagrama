import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Box, KeyRound } from 'lucide-react'
import { visibilitySymbols, type UmlClass } from '../domain/model'

export type ClassFlowNode = Node<{ uml: UmlClass }, 'umlClass'>
export function ClassNode({ data, selected }: NodeProps<ClassFlowNode>) {
  const c = data.uml
  return (
    <div className={`class-node ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="class-heading">
        <span className="class-icon">
          <Box size={16} />
        </span>
        <div>
          <span className="node-kind">{c.abstract ? 'CLASE ABSTRACTA' : 'CLASE'}</span>
          <strong className={c.abstract ? 'abstract' : ''}>{c.name}</strong>
        </div>
      </div>
      <div className="class-attributes">
        {c.attributes.length === 0 ? (
          <p className="node-empty">Sin atributos</p>
        ) : (
          c.attributes.map((a) => (
            <div key={a.id} className="node-attribute">
              <span className="visibility">{visibilitySymbols[a.visibility]}</span>
              <span>
                {a.name}
                {a.required ? '' : '?'}
              </span>
              <span className="attribute-type">: {a.dataType}</span>
              {a.identifier && <KeyRound size={12} aria-label="Identificador" />}
            </div>
          ))
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
