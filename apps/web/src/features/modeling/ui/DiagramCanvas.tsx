import { useMemo, useState, useRef, useLayoutEffect, type RefObject } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionLineType,
  type Connection,
  type Edge,
  type XYPosition,
  type ReactFlowInstance,
} from '@xyflow/react'
import { ClassNode, type ClassFlowNode } from './ClassNode'
import { GeneralizationEdge } from './GeneralizationEdge'
import { AssociationEdge } from './AssociationEdge'
import { AssociationClassEdge } from './AssociationClassEdge'
import { generalizationLine } from './generalizationGeometry'
import type { Diagram, ModelCommand, UmlRelation } from '../domain/model'

const nodeTypes = { umlClass: ClassNode }
const edgeTypes = {
  generalization: GeneralizationEdge,
  association: AssociationEdge,
  associationClass: AssociationClassEdge,
}
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
      const origin = { x: center.x - 120, y: center.y - 50 }
      const topLeft = flow.current?.screenToFlowPosition({ x: bounds.left, y: bounds.top })
      const bottomRight = flow.current?.screenToFlowPosition({ x: bounds.right, y: bounds.bottom })
      if (!topLeft || !bottomRight) return origin
      // Choose an on-screen location with as little overlap as possible.
      const maxX = Math.max(topLeft.x, bottomRight.x - 240)
      const maxY = Math.max(topLeft.y, bottomRight.y - 100)
      const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(n, high))
      const candidates = [0, -1, 1].flatMap(y => [0, -1, 1].map(x => ({
        x: clamp(origin.x + x * 260, topLeft.x, maxX),
        y: clamp(origin.y + y * 140, topLeft.y, maxY),
      })))
      const overlap = (candidate: XYPosition) => diagram.classes.reduce((total, item) => {
        const width = Math.max(0, Math.min(candidate.x + 240, item.position.x + 240) - Math.max(candidate.x, item.position.x))
        const height = Math.max(0, Math.min(candidate.y + 100, item.position.y + 100) - Math.max(candidate.y, item.position.y))
        return total + width * height
      }, 0)
      return candidates.reduce((best, candidate) => overlap(candidate) < overlap(best) ? candidate : best)
    }
    return () => { newClassPosition.current = null }
  }, [newClassPosition, diagram.classes])
  const [positions, setPositions] = useState<Record<string, XYPosition>>({})
  const [connecting, setConnecting] = useState(false)
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>(
    {},
  )
  const nodes: ClassFlowNode[] = useMemo(
    () =>
      diagram.classes.map((c) => ({
        id: c.id,
        type: 'umlClass',
        position: positions[c.id] ?? c.position,
        data: { uml: c, connecting },
        selected: c.id === selectedId,
        measured: dimensions[c.id],
      })),
    [diagram.classes, positions, dimensions, selectedId, connecting],
  )
  const rectangle = (id: string) => {
    const node = nodes.find((n) => n.id === id)!
    return {
      ...node.position,
      width: node.measured?.width ?? 240,
      height: node.measured?.height ?? 100,
    }
  }
  const edges: Edge[] = diagram.relations.flatMap((r) => {
    const relation: Edge = {
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
    }
    // EA represents an association class as an association plus its linked class.
    // Show the conventional dashed link without making it a second editable relation.
    const associationClass = r.type === 'association' && r.associationClassId
      && diagram.classes.some((c) => c.id === r.associationClassId)
      ? (() => {
          const associationLine = generalizationLine(rectangle(r.sourceId), rectangle(r.targetId))
          const start = {
            x: (associationLine.start.x + associationLine.end.x) / 2,
            y: (associationLine.start.y + associationLine.end.y) / 2,
          }
          const target = rectangle(r.associationClassId)
          const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
          const dx = start.x - center.x
          const dy = start.y - center.y
          const scale = Math.max(Math.abs(dx) / (target.width / 2), Math.abs(dy) / (target.height / 2)) || 1
          const end = { x: center.x + dx / scale, y: center.y + dy / scale }
          return [{
            id: `${r.id}:association-class`,
            source: r.sourceId,
            target: r.associationClassId,
            type: 'associationClass',
            data: { start, end },
            selectable: false,
            focusable: false,
            style: { stroke: '#737c91', strokeWidth: 1.4, strokeDasharray: '6 5' },
          } satisfies Edge]
        })()
      : []
    return [relation, ...associationClass]
  })
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
        onConnect={(connection) => { if (!busy) connect(connection) }}
        connectOnClick={false}
        connectionLineType={ConnectionLineType.Straight}
        connectionLineStyle={{ stroke: '#545968', strokeWidth: 1.6, strokeDasharray: '6 4' }}
        onConnectStart={() => {
          setConnecting(true)
          setEditing?.('connection', true)
        }}
        onConnectEnd={(event, connection) => {
          setConnecting(false)
          setEditing?.('connection', false)
          // Native handle drops already invoke onConnect. Also accept the body
          // of a class, as in EA's quick linker, without creating a duplicate.
          if (busy || connection.isValid || !connection.fromNode || event.type === 'touchcancel') return
          const point = 'changedTouches' in event ? event.changedTouches[0] : event
          if (!point) return
          const element = document.elementFromPoint(point.clientX, point.clientY)
          const target = element?.closest<HTMLElement>('.react-flow__node')
          const targetId = target?.dataset.id
          if (targetId && canvas.current?.contains(target!) &&
              targetId !== connection.fromNode.id && diagram.classes.some((c) => c.id === targetId)) {
            connect({ source: connection.fromNode.id, target: targetId,
              sourceHandle: connection.fromHandle?.id ?? null, targetHandle: null })
          }
        }}
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
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#98a5ba" />
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
