import { useMemo, useState, useRef, useLayoutEffect, type RefObject } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type XYPosition,
  type ReactFlowInstance,
} from '@xyflow/react'
import { ClassNode, type ClassFlowNode } from './ClassNode'
import { GeneralizationEdge } from './GeneralizationEdge'
import { AssociationEdge } from './AssociationEdge'
import { generalizationLine } from './generalizationGeometry'
import type { Diagram, ModelCommand, UmlRelation } from '../domain/model'

const nodeTypes = { umlClass: ClassNode }
const edgeTypes = { generalization: GeneralizationEdge, association: AssociationEdge }
const ariaLabels = {
  'controls.ariaLabel': 'Controles del lienzo',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Ajustar a la vista',
  'minimap.ariaLabel': 'Mapa del diagrama',
  'node.a11yDescription.keyboardDisabled':
    'Pulsa Enter para seleccionar. Usa las flechas para mover la clase y guardar su posición. Elimina desde el panel de propiedades.',
  'edge.a11yDescription.default': 'Haz clic en la relación para editarla.',
}
export function DiagramCanvas({
  diagram,
  selectedId,
  select,
  execute,
  connect,
  editRelation,
  deleteClass,
  busy,
  setEditing,
  newClassPosition,
}: {
  diagram: Diagram
  selectedId: string | null
  select: (id: string | null) => void
  busy: boolean
  setEditing?: (area: string, pending: boolean) => void
  newClassPosition: RefObject<(() => XYPosition) | null>
  execute: (command: ModelCommand) => Promise<boolean>
  connect: (connection: Connection) => void
  editRelation: (relation: UmlRelation) => void
  deleteClass: (id: string) => void
}) {
  const canvas = useRef<HTMLDivElement>(null)
  const flow = useRef<ReactFlowInstance<ClassFlowNode> | null>(null)
  useLayoutEffect(() => {
    newClassPosition.current = () => {
      const bounds = canvas.current!.getBoundingClientRect()
      const center = flow.current?.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }) ?? { x: 120, y: 50 }
      return { x: center.x - 120, y: center.y - 50 }
    }
    return () => { newClassPosition.current = null }
  }, [newClassPosition])
  const [positions, setPositions] = useState<Record<string, XYPosition>>({})
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>(
    {},
  )
  const nodes: ClassFlowNode[] = useMemo(
    () =>
      diagram.classes.map((c) => ({
        id: c.id,
        type: 'umlClass',
        position: positions[c.id] ?? c.position,
        data: { uml: c },
        selected: c.id === selectedId,
        measured: dimensions[c.id],
      })),
    [diagram.classes, positions, dimensions, selectedId],
  )
  const rectangle = (id: string) => {
    const node = nodes.find((n) => n.id === id)!
    return {
      ...node.position,
      width: node.measured?.width ?? 240,
      height: node.measured?.height ?? 100,
    }
  }
  const edges: Edge[] = diagram.relations.map((r) => ({
    id: r.id,
    source: r.sourceId,
    target: r.targetId,
    type: r.sourceId === r.targetId ? 'smoothstep' : r.type,
    data: {
      ...generalizationLine(rectangle(r.sourceId), rectangle(r.targetId)),
      sourceMultiplicity: r.sourceMultiplicity,
      targetMultiplicity: r.targetMultiplicity,
    },
    label:
      r.sourceId === r.targetId
        ? `${r.sourceMultiplicity} · ${r.name || 'asociación'} · ${r.targetMultiplicity}`
        : r.name || undefined,
    markerEnd: r.type === 'generalization' ? 'uml-inheritance' : undefined,
    style: { stroke: '#737c91', strokeWidth: 1.6 },
    labelStyle: { fill: '#566079', fontSize: 11 },
    labelBgStyle: { fill: '#fff' },
    labelBgPadding: [8, 5],
    labelBgBorderRadius: 5,
  }))
  return (
    <div
      className="canvas"
      ref={canvas}
      aria-label="Lienzo del diagrama"
      onKeyDownCapture={(event) => {
        if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
        const node = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node')
        const c = diagram.classes.find((c) => c.id === node?.dataset.id)
        if (!c) return
        if (event.key === 'Delete') {
          event.preventDefault()
          event.stopPropagation()
          if (!busy && !event.repeat) deleteClass(c.id)
          return
        }
        if (event.key === 'Enter' || event.key === ' ') select(c.id)
        const directions: Record<string, XYPosition> = {
          ArrowLeft: { x: -1, y: 0 },
          ArrowRight: { x: 1, y: 0 },
          ArrowUp: { x: 0, y: -1 },
          ArrowDown: { x: 0, y: 1 },
        }
        const direction = directions[event.key]
        if (direction) {
          event.preventDefault()
          event.stopPropagation()
          if (!busy) {
            const step = event.shiftKey ? 40 : 10
            void execute({
              type: 'moveClass',
              id: c.id,
              position: {
                x: c.position.x + direction.x * step,
                y: c.position.y + direction.y * step,
              },
            })
          }
        }
      }}
    >
      <svg className="marker-definitions" aria-hidden="true">
        <defs>
          <marker
            id="uml-inheritance"
            viewBox="0 0 14 14"
            refX="13"
            refY="7"
            markerWidth="14"
            markerHeight="14"
            orient="auto"
          >
            <path d="M1 1 L13 7 L1 13 Z" fill="white" stroke="#737c91" />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        onInit={(instance) => { flow.current = instance }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        ariaLabelConfig={ariaLabels}
        onNodesChange={(changes) => {
          for (const change of changes) {
            if (change.type === 'position' && change.position) {
              const position = change.position
              setPositions((current) => ({ ...current, [change.id]: position }))
            }
            if (change.type === 'dimensions' && change.dimensions) {
              const measured = change.dimensions
              setDimensions((current) =>
                current[change.id]?.width === measured.width &&
                current[change.id]?.height === measured.height
                  ? current
                  : { ...current, [change.id]: measured },
              )
            }
          }
        }}
        onNodeClick={(_, node) => select(node.id)}
        onPaneClick={() => select(null)}
        onNodeDragStart={() => setEditing?.('drag', true)}
        onNodeDragStop={async (_, node) => {
          await execute({ type: 'moveClass', id: node.id, position: node.position })
          setEditing?.('drag', false)
          setPositions((current) => {
            const next = { ...current }
            delete next[node.id]
            return next
          })
        }}
        onConnect={connect}
        onEdgeClick={(_, edge) => {
          const r = diagram.relations.find((r) => r.id === edge.id)
          if (r) editRelation(r)
        }}
        nodesDraggable={!busy}
        nodesConnectable={!busy}
        deleteKeyCode={null}
        minZoom={0.25}
        maxZoom={2}
        fitView={diagram.classes.length > 0}
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#b9c2d2" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor="#dfe2ff"
          nodeStrokeColor="#8b85e8"
          maskColor="rgba(246,247,251,.7)"
          pannable
          zoomable
        />
      </ReactFlow>
      {diagram.classes.length === 0 && (
        <div className="canvas-welcome">
          <span className="welcome-symbol">＋</span>
          <h2>Todo empieza con una clase</h2>
          <p>
            Agrega tu primera clase y construye
            <br />
            las relaciones de tu modelo.
          </p>
        </div>
      )}
    </div>
  )
}
