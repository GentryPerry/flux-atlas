import { useState, useMemo, useCallback } from 'react';
import {
  UserCircle, MapPin, Shield, Cross, Lightning, Sword,
  ArrowSquareIn, CaretDown,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const ICON_MAP = { UserCircle, MapPin, Shield, Cross, Lightning, Sword };

const TYPE_COLORS = {
  character: 'var(--node-character)',
  location: 'var(--node-location)',
  faction: 'var(--node-faction)',
  religion: 'var(--node-religion)',
  event: 'var(--node-event)',
  realm: 'var(--node-realm)',
  thing: 'var(--node-thing)',
};

/**
 * Kanban-style relationship board.
 * Groups NPC/location nodes into columns by faction/religion membership.
 * Drag cards between columns to reassign relationships.
 */
export default function KanbanBoard({ groupBy = 'faction' }) {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectNode = useNodeStore((s) => s.selectNode);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const tags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const [dragNodeId, setDragNodeId] = useState(null);
  const [groupMode, setGroupMode] = useState(groupBy);

  // Get all nodes on this map
  const mapNodes = useMemo(
    () => allNodes.filter((n) => n.mapId === activeMapId),
    [allNodes, activeMapId]
  );

  // Group nodes are the column headers (factions or religions)
  const groupType = groupMode; // 'faction' or 'religion'
  const groupNodes = useMemo(
    () => mapNodes.filter((n) => n.type === groupType),
    [mapNodes, groupType]
  );

  // The field key on member nodes that points to the group
  const fieldKey = groupType === 'faction' ? 'faction' : 'religion';

  // Member nodes are characters (NPCs) that can belong to groups
  const memberNodes = useMemo(
    () => mapNodes.filter((n) => n.type === 'character'),
    [mapNodes]
  );

  // Build columns: each group node becomes a column
  const columns = useMemo(() => {
    const cols = groupNodes.map((gNode) => {
      // Find tag for this group node
      const gTag = tags.find(
        (t) => t.name.toLowerCase() === (gNode.fields?.name || '').toLowerCase()
      );
      const gTagId = gTag?.id;

      const members = memberNodes.filter((mn) => {
        const tagIds = mn.fields?.[fieldKey] || [];
        return gTagId && tagIds.includes(gTagId);
      });

      return {
        id: gNode.id,
        name: gNode.fields?.name || 'Unnamed',
        color: TYPE_COLORS[groupType],
        members,
        tagId: gTagId,
      };
    });

    // Unassigned column
    const assignedIds = new Set();
    for (const col of cols) {
      for (const m of col.members) assignedIds.add(m.id);
    }
    const unassigned = memberNodes.filter((mn) => !assignedIds.has(mn.id));

    return [
      ...cols,
      {
        id: '__unassigned__',
        name: 'Unassigned',
        color: 'var(--text-muted)',
        members: unassigned,
        tagId: null,
      },
    ];
  }, [groupNodes, memberNodes, tags, fieldKey, groupType]);

  const handleDragStart = useCallback((nodeId) => {
    setDragNodeId(nodeId);
  }, []);

  const handleDrop = useCallback((columnId, columnTagId) => {
    if (!dragNodeId || !campaignId) return;
    const node = allNodes.find((n) => n.id === dragNodeId);
    if (!node) return;

    const currentTags = node.fields?.[fieldKey] || [];

    if (columnId === '__unassigned__') {
      // Remove all group tags
      updateNodeFields(campaignId, dragNodeId, { [fieldKey]: [] });
    } else {
      // Find or create tag for this column
      const col = columns.find((c) => c.id === columnId);
      let tagId = columnTagId;
      if (!tagId && col) {
        let tag = tags.find((t) => t.name.toLowerCase() === col.name.toLowerCase());
        if (!tag) {
          tag = createTag(campaignId, col.name);
        }
        tagId = tag.id;
      }
      if (tagId && !currentTags.includes(tagId)) {
        // Remove from other groups and add to this one
        const otherTagIds = columns
          .filter((c) => c.id !== columnId && c.tagId)
          .map((c) => c.tagId);
        const cleaned = currentTags.filter((id) => !otherTagIds.includes(id));
        updateNodeFields(campaignId, dragNodeId, { [fieldKey]: [...cleaned, tagId] });
      }
    }

    setDragNodeId(null);
  }, [dragNodeId, campaignId, allNodes, fieldKey, columns, tags, createTag, updateNodeFields]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Mode selector */}
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Group by:
        </span>
        <button
          className={`card-filter-chip ${groupMode === 'faction' ? 'active' : ''}`}
          onClick={() => setGroupMode('faction')}
          style={groupMode === 'faction' ? { borderColor: 'var(--node-faction)', color: 'var(--node-faction)' } : {}}
        >
          Faction
        </button>
        <button
          className={`card-filter-chip ${groupMode === 'religion' ? 'active' : ''}`}
          onClick={() => setGroupMode('religion')}
          style={groupMode === 'religion' ? { borderColor: 'var(--node-religion)', color: 'var(--node-religion)' } : {}}
        >
          Religion
        </button>
      </div>

      {/* Board */}
      <div className="kanban-view">
        {columns.map((col) => (
          <div
            key={col.id}
            className="kanban-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.id, col.tagId)}
          >
            <div className="kanban-column-header">
              <div className="dot" style={{ background: col.color }} />
              <span>{col.name}</span>
              <span className="count">{col.members.length}</span>
            </div>
            <div className="kanban-column-body">
              {col.members.map((node) => {
                const schema = NODE_TYPES[node.type];
                const Icon = ICON_MAP[schema?.icon] || UserCircle;
                const color = TYPE_COLORS[node.type];
                return (
                  <div
                    key={node.id}
                    className={`kanban-card ${dragNodeId === node.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(node.id)}
                    onClick={() => selectNode(node.id)}
                  >
                    <div className="mini-icon" style={{ background: `${color}18`, color }}>
                      <Icon size={14} weight="duotone" />
                    </div>
                    <span>{node.fields?.name || 'Unnamed'}</span>
                  </div>
                );
              })}
              {col.members.length === 0 && (
                <div className="kanban-unassigned" style={{ padding: '12px 8px', fontSize: 12 }}>
                  {col.id === '__unassigned__' ? 'NPCs without a group' : 'Drop NPCs here'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
