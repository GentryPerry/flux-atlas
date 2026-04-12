import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Image as KImage, Circle, Shape, Text, Group, Rect, Line } from 'react-konva';
import useMapStore from '../../stores/mapStore';
import useNodeStore from '../../stores/nodeStore';
import useConnectionStore from '../../stores/connectionStore';
import useCampaignStore from '../../stores/campaignStore';
import useTerritoryStore from '../../stores/territoryStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const TYPE_COLORS = {
  character: '#c084fc',
  location: '#60a5fa',
  faction: '#fb923c',
  religion: '#fbbf24',
  event: '#f87171',
  realm: '#e879a8',
  thing: '#4ade80',
};

const NODE_RADIUS = 20;

/** Compute bezier curve control point offset based on distance */
function getCurveOffset(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.min(dist * 0.25, 80);
}

export default function MapCanvas({ placingType, onPlacingDone, showConnections, connectingFrom, onConnectionClick, onNodeContextMenu, drawingMode, setDrawingMode }) {
  const stageRef = useRef(null);
  const [bgImage, setBgImage] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const containerRef = useRef(null);
  const [polygonPoints, setPolygonPoints] = useState([]);

  const activeMapId = useMapStore((s) => s.activeMapId);
  const allMaps = useMapStore((s) => s.maps);
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);
  const selectNode = useNodeStore((s) => s.selectNode);
  const deselectNode = useNodeStore((s) => s.deselectNode);
  const createNode = useNodeStore((s) => s.createNode);
  const moveNode = useNodeStore((s) => s.moveNode);
  const allConnections = useConnectionStore((s) => s.connections);
  const allTerritories = useTerritoryStore((s) => s.territories);
  const createTerritory = useTerritoryStore((s) => s.createTerritory);

  // Derive filtered values with useMemo instead of filtering in selectors
  const activeMap = useMemo(
    () => allMaps.find((m) => m.id === activeMapId) || null,
    [allMaps, activeMapId]
  );
  const nodes = useMemo(
    () => allNodes.filter((n) => n.mapId === activeMapId),
    [allNodes, activeMapId]
  );
  const connections = useMemo(() => {
    const nodeIds = new Set(nodes.map((n) => n.id));
    return allConnections.filter((c) => nodeIds.has(c.nodeAId) && nodeIds.has(c.nodeBId));
  }, [allConnections, nodes]);
  const territories = useMemo(
    () => allTerritories.filter((t) => t.mapId === activeMapId),
    [allTerritories, activeMapId]
  );

  // Load background image
  useEffect(() => {
    if (!activeMap?.image) { setBgImage(null); return; }
    const img = new window.Image();
    img.onload = () => setBgImage(img);
    img.src = activeMap.image;
  }, [activeMap?.image]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.1, Math.min(5, oldScale * (1 + direction * 0.1)));
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos]);

  // Double-click to finish polygon drawing
  const handleStageDoubleClick = useCallback((e) => {
    if (drawingMode === 'polygon' && polygonPoints.length >= 3) {
      // Create territory from polygon points
      createTerritory(campaignId, activeMapId, 'polygon', {
        points: polygonPoints,
      });
      setPolygonPoints([]);
      setDrawingMode(null);
    }
  }, [drawingMode, polygonPoints, campaignId, activeMapId, createTerritory, setDrawingMode]);

  // Click on canvas — place node, draw polygon, or deselect
  const handleStageClick = useCallback((e) => {
    // Allow clicks on stage background or background elements only
    const targetName = e.target?.name?.() || '';
    const isStage = e.target === e.currentTarget;
    const isBg = targetName === 'bg-image' || targetName === 'bg-rect';
    if (!isStage && !isBg) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    const x = (pointer.x - stagePos.x) / stageScale;
    const y = (pointer.y - stagePos.y) / stageScale;

    if (drawingMode === 'polygon') {
      // Add point to polygon
      setPolygonPoints([...polygonPoints, { x, y }]);
    } else if (placingType) {
      createNode(campaignId, activeMapId, placingType, x, y);
      onPlacingDone();
    } else {
      deselectNode();
    }
  }, [placingType, drawingMode, campaignId, activeMapId, createNode, onPlacingDone, deselectNode, stagePos, stageScale, polygonPoints]);

  const handleNodeDragEnd = useCallback((nodeId, e) => {
    moveNode(campaignId, nodeId, e.target.x(), e.target.y());
  }, [campaignId, moveNode]);

  const handleNodeClick = useCallback((nodeId, e) => {
    e.cancelBubble = true;
    if (connectingFrom) {
      onConnectionClick(nodeId);
    } else {
      selectNode(nodeId);
    }
  }, [selectNode, connectingFrom, onConnectionClick]);

  const handleNodeRightClick = useCallback((nodeId, e) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    // Get viewport coordinates for positioning context menu
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container().getBoundingClientRect();
    const pointer = stage.getPointerPosition();
    onNodeContextMenu?.(nodeId, container.left + pointer.x, container.top + pointer.y);
  }, [onNodeContextMenu]);

  // Build node lookup
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        cursor: placingType ? 'crosshair' : drawingMode === 'polygon' ? 'crosshair' : connectingFrom ? 'pointer' : 'default',
        borderRadius: 'var(--radius)',
      }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={!placingType && drawingMode !== 'polygon'}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDblClick={handleStageDoubleClick}
      >
        <Layer>
          {/* Background */}
          {bgImage ? (
            <KImage image={bgImage} name="bg-image" />
          ) : (
            <Rect
              name="bg-rect"
              x={-3000}
              y={-3000}
              width={6000}
              height={6000}
              fill="#0c0e14"
              listening={true}
            />
          )}

          {/* Territories */}
          {territories.map((territory) => {
            if (territory.shapeType === 'polygon') {
              // Flatten points array for Konva Line: [x1, y1, x2, y2, ...]
              const flatPoints = [];
              for (const p of territory.points) {
                flatPoints.push(p.x, p.y);
              }
              return (
                <Line
                  key={territory.id}
                  points={flatPoints}
                  closed={true}
                  fill={territory.color}
                  opacity={territory.opacity}
                  stroke={territory.strokeColor}
                  strokeWidth={territory.strokeWidth}
                  listening={false}
                />
              );
            } else if (territory.shapeType === 'rectangle') {
              return (
                <Rect
                  key={territory.id}
                  x={territory.x}
                  y={territory.y}
                  width={territory.width}
                  height={territory.height}
                  fill={territory.color}
                  opacity={territory.opacity}
                  stroke={territory.strokeColor}
                  strokeWidth={territory.strokeWidth}
                  listening={false}
                />
              );
            } else if (territory.shapeType === 'circle') {
              return (
                <Circle
                  key={territory.id}
                  x={territory.center?.cx || 0}
                  y={territory.center?.cy || 0}
                  radius={territory.radius}
                  fill={territory.color}
                  opacity={territory.opacity}
                  stroke={territory.strokeColor}
                  strokeWidth={territory.strokeWidth}
                  listening={false}
                />
              );
            }
            return null;
          })}

          {/* Polygon preview while drawing */}
          {drawingMode === 'polygon' && polygonPoints.length > 0 && (
            <Line
              points={polygonPoints.flatMap((p) => [p.x, p.y])}
              stroke="#8890a0"
              strokeWidth={2}
              opacity={0.5}
              listening={false}
            />
          )}

          {/* Polygon point markers while drawing */}
          {drawingMode === 'polygon' && polygonPoints.map((p, i) => (
            <Circle
              key={`polygon-point-${i}`}
              x={p.x}
              y={p.y}
              radius={5}
              fill="#8890a0"
              opacity={0.7}
              listening={false}
            />
          ))}

          {/* Curved connections (SugarCRM-inspired bezier lines) */}
          {showConnections && connections.map((conn) => {
            const a = nodeMap[conn.nodeAId];
            const b = nodeMap[conn.nodeBId];
            if (!a || !b) return null;

            const color = conn.color || '#6e8efb';
            const offset = getCurveOffset(a.x, a.y, b.x, b.y);

            // Perpendicular offset for curve
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const cpx = (a.x + b.x) / 2 + nx * offset * 0.4;
            const cpy = (a.y + b.y) / 2 + ny * offset * 0.4;

            return (
              <Group key={conn.id}>
                {/* Glow behind the line */}
                <Shape
                  sceneFunc={(ctx) => {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 6;
                    ctx.globalAlpha = 0.08;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                  }}
                />
                {/* Main curve */}
                <Shape
                  sceneFunc={(ctx) => {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.5;
                    if (!conn.directional) {
                      ctx.setLineDash([6, 4]);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;

                    // Arrowhead for directional
                    if (conn.directional) {
                      const angle = Math.atan2(b.y - cpy, b.x - cpx);
                      const arrowLen = 10;
                      ctx.beginPath();
                      ctx.moveTo(b.x, b.y);
                      ctx.lineTo(
                        b.x - arrowLen * Math.cos(angle - 0.4),
                        b.y - arrowLen * Math.sin(angle - 0.4)
                      );
                      ctx.moveTo(b.x, b.y);
                      ctx.lineTo(
                        b.x - arrowLen * Math.cos(angle + 0.4),
                        b.y - arrowLen * Math.sin(angle + 0.4)
                      );
                      ctx.strokeStyle = color;
                      ctx.lineWidth = 2;
                      ctx.globalAlpha = 0.6;
                      ctx.stroke();
                      ctx.globalAlpha = 1;
                    }
                  }}
                />
                {/* Connection label */}
                {conn.label && (
                  <Group x={cpx} y={cpy - 10}>
                    <Rect
                      x={-conn.label.length * 3.5 - 6}
                      y={-8}
                      width={conn.label.length * 7 + 12}
                      height={18}
                      fill="#181a24"
                      cornerRadius={4}
                      opacity={0.9}
                    />
                    <Text
                      text={conn.label}
                      fontSize={10}
                      fill="#8890a0"
                      fontFamily="Inter, sans-serif"
                      align="center"
                      width={conn.label.length * 7 + 12}
                      offsetX={conn.label.length * 3.5 + 6}
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const color = TYPE_COLORS[node.type] || '#8890a0';
            const isSelected = node.id === selectedNodeId;
            const name = node.fields?.name || node.type;

            return (
              <Group
                key={node.id}
                x={node.x}
                y={node.y}
                draggable
                onDragEnd={(e) => handleNodeDragEnd(node.id, e)}
                onClick={(e) => handleNodeClick(node.id, e)}
                onTap={(e) => handleNodeClick(node.id, e)}
                onContextMenu={(e) => handleNodeRightClick(node.id, e)}
              >
                {/* Selection outer glow */}
                {isSelected && (
                  <>
                    <Circle
                      radius={NODE_RADIUS + 8}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={1.5}
                      opacity={0.2}
                    />
                    <Circle
                      radius={NODE_RADIUS + 3}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={2}
                      opacity={0.6}
                    />
                  </>
                )}

                {/* Node body — dark filled circle with colored border */}
                <Circle
                  radius={NODE_RADIUS}
                  fill="#181a24"
                  stroke={color}
                  strokeWidth={2.5}
                  shadowColor={isSelected ? color : 'rgba(0,0,0,0.5)'}
                  shadowBlur={isSelected ? 16 : 6}
                  shadowOpacity={isSelected ? 0.4 : 0.3}
                  shadowOffsetY={isSelected ? 0 : 2}
                />

                {/* Inner accent — subtle colored dot */}
                <Circle
                  radius={6}
                  fill={color}
                  opacity={isSelected ? 0.9 : 0.5}
                />

                {/* Dead indicator */}
                {node.statusFlags && !node.statusFlags.alive && (
                  <Group x={NODE_RADIUS - 4} y={-NODE_RADIUS + 2}>
                    <Circle radius={7} fill="#181a24" />
                    <Circle radius={5} fill="#f87171" opacity={0.8} />
                    <Text text="x" fontSize={8} fill="#fff" x={-3} y={-4} fontStyle="bold" />
                  </Group>
                )}

                {/* Hidden indicator */}
                {node.statusFlags && !node.statusFlags.revealed && (
                  <Group x={-NODE_RADIUS + 4} y={-NODE_RADIUS + 2}>
                    <Circle radius={5} fill="#181a24" />
                    <Circle radius={4} fill="#555d6e" opacity={0.6} />
                  </Group>
                )}

                {/* Label */}
                <Text
                  text={name}
                  fontSize={11}
                  fontFamily="Inter, sans-serif"
                  fill="#eaedf3"
                  y={NODE_RADIUS + 8}
                  align="center"
                  width={120}
                  offsetX={60}
                  shadowColor="#000"
                  shadowBlur={4}
                  shadowOpacity={0.9}
                  fontStyle={isSelected ? 'bold' : 'normal'}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
