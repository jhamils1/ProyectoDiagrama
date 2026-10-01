import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowRight, KeyRound } from 'lucide-react'
import { visibilitySymbols, type UmlClass } from '../domain/model'

export type ClassFlowNode = Node<{ uml: UmlClass }, 'umlClass'>
export function ClassNode({ data, selected }: NodeProps<ClassFlowNode>) {
  const c = data.uml
  return (
    <div className={`class-node ${selected ? 'is-selected' : ''}`}>
      <Handle id="target-left" type="target" position={Position.Left} className="uml-target-handle" />
      <Handle id="target-right" type="target" position={Position.Right} className="uml-target-handle" />
      <Handle id="target-top" type="target" position={Position.Top} className="uml-target-handle" />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="uml-target-handle" />
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
      {selected && (
        <>
          <span className="relationship-drag-icon" aria-hidden="true">
            <ArrowRight size={19} strokeWidth={2.4} />
          </span>
          <Handle
            id="relationship-source"
            type="source"
            position={Position.Right}
            className="relationship-drag-handle"
            aria-label={`Arrastra desde ${c.name} hacia otra clase para crear una relacion`}
            title="Arrastra hacia otra clase para crear una relacion"
          />
        </>
      )}
    </div>
  )
}
