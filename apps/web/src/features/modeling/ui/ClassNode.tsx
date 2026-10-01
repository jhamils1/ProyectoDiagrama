import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { KeyRound } from 'lucide-react'
import { visibilitySymbols, type UmlClass } from '../domain/model'

export type ClassFlowNode = Node<{ uml: UmlClass; connecting?: boolean }, 'umlClass'>
export function ClassNode({ data, selected, isConnectable }: NodeProps<ClassFlowNode>) {
  const c = data.uml
  return (
    <div className={`class-node ${selected ? 'is-selected' : ''} ${data.connecting ? 'is-connecting' : ''}`}>
      <Handle id="target-left" type="target" position={Position.Left} className="uml-target-handle" isConnectable={isConnectable} isConnectableStart={false} />
      <Handle id="target-top" type="target" position={Position.Top} className="uml-target-handle" isConnectable={isConnectable} isConnectableStart={false} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="uml-target-handle" isConnectable={isConnectable} isConnectableStart={false} />
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
      {/* Keep the handle mounted so React Flow measures it before selection. */}
        <Handle
          id="relationship-source"
          type="source"
          position={Position.Right}
          className="relationship-drag-handle"
          isConnectable={isConnectable}
          isConnectableStart={!!selected && isConnectable}
          aria-hidden={!selected || !isConnectable}
          aria-label={`Arrastra desde ${c.name} hacia otra clase para crear una relación`}
          title="Arrastra hacia otra clase para crear una relación"
        />
    </div>
  )
}
