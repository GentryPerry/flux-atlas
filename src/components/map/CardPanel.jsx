import { useState, useMemo } from 'react';
import {
  MagnifyingGlass, Funnel, X, ArrowSquareIn,
  UserCircle, MapPin, Shield, Cross, Lightning, Sword, Crown,
  Eye, EyeSlash, Skull,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const ICON_MAP = {
  UserCircle, MapPin, Shield, Cross, Lightning, Sword, Crown,
};

const TYPE_COLORS = {
  character: 'var(--node-character)',
  location: 'var(--node-location)',
  faction: 'var(--node-faction)',
  religion: 'var(--node-religion)',
  event: 'var(--node-event)',
  realm: 'var(--node-realm)',
  thing: 'var(--node-thing)',
};

export default function CardPanel() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);
  const selectNode = useNodeStore((s) => s.selectNode);
  const tags = useTagStore((s) => s.tags);
  const drillDown = useMapStore((s) => s.drillDown);
  const maps = useMapStore((s) => s.maps);

  const nodes = useMemo(
    () => allNodes.filter((n) => n.mapId === activeMapId),
    [allNodes, activeMapId]
  );

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(null);

  const filtered = useMemo(() => {
    let result = nodes;
    if (filterType) result = result.filter((n) => n.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((n) => {
        const name = n.fields?.name?.toLowerCase() || '';
        const desc = n.fields?.description?.toLowerCase() || '';
        return name.includes(q) || desc.includes(q);
      });
    }
    return result.sort((a, b) => (a.fields?.name || '').localeCompare(b.fields?.name || ''));
  }, [nodes, filterType, search]);

  const typeFilters = Object.entries(NODE_TYPES);

  return (
    <div className="card-panel">
      {/* Search & filters */}
      <div className="card-panel-header">
        <div className="card-panel-search">
          <MagnifyingGlass size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
          />
          {search && (
            <button className="btn-icon" onClick={() => setSearch('')} style={{ padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>
        <div className="card-panel-filters">
          <button
            className={`card-filter-chip ${!filterType ? 'active' : ''}`}
            onClick={() => setFilterType(null)}
          >
            All ({nodes.length})
          </button>
          {typeFilters.map(([key, schema]) => {
            const count = nodes.filter((n) => n.type === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                className={`card-filter-chip ${filterType === key ? 'active' : ''}`}
                onClick={() => setFilterType(filterType === key ? null : key)}
                style={filterType === key ? { borderColor: TYPE_COLORS[key], color: TYPE_COLORS[key] } : {}}
              >
                {schema.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <div className="card-panel-body">
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <Funnel size={32} />
            <span>No nodes match your filter</span>
          </div>
        )}

        {filtered.map((node) => {
          const schema = NODE_TYPES[node.type];
          const iconName = schema?.icon || 'Cube';
          const Icon = ICON_MAP[iconName] || MapPin;
          const color = TYPE_COLORS[node.type] || 'var(--text-secondary)';
          const isSelected = node.id === selectedNodeId;
          const childMap = maps.find((m) => m.parentMapId === node.id);
          const heroImage = (node.images || [])[0]?.url;

          // Collect tag fields
          const tagFields = (schema?.fields || []).filter((f) => f.type === 'tags');
          const allFieldTags = [];
          for (const field of tagFields) {
            const ids = node.fields?.[field.key] || [];
            for (const id of ids) {
              const tag = tags.find((t) => t.id === id);
              if (tag) allFieldTags.push(tag);
            }
          }

          return (
            <div
              key={node.id}
              className={`node-card ${isSelected ? 'selected' : ''}`}
              onClick={() => selectNode(node.id)}
              style={isSelected ? { borderColor: color } : {}}
            >
              {/* Card image banner */}
              {heroImage && (
                <img className="node-card-image" src={heroImage} alt="" />
              )}

              <div className="node-card-inner" style={{ borderLeftColor: color }}>
                <div className="node-card-header">
                  <div className="node-card-icon" style={{ background: `${color}18`, color }}>
                    <Icon size={18} weight="duotone" />
                  </div>
                  <div className="node-card-title">
                    <span className="node-card-name">{node.fields?.name || 'Unnamed'}</span>
                    <span className="node-card-type" style={{ color }}>{schema?.label}</span>
                  </div>
                  <div className="node-card-status">
                    {schema?.statusFlags && Object.entries(schema.statusFlags).map(([flagKey, flagDef]) => {
                      if (flagKey === 'revealed') return null;
                      const isOn = node.statusFlags?.[flagKey] ?? flagDef.default;
                      if (isOn) return null;
                      return (
                        <span key={flagKey} className="status-badge status-dead">
                          <Skull size={11} /> {flagDef.offLabel}
                        </span>
                      );
                    })}
                    {node.statusFlags?.revealed ? (
                      <span className="status-badge status-revealed"><Eye size={11} /> Visible</span>
                    ) : (
                      <span className="status-badge status-hidden"><EyeSlash size={11} /> Hidden</span>
                    )}
                  </div>
                </div>

                {node.fields?.description && (
                  <p className="node-card-desc">
                    {node.fields.description.length > 120
                      ? node.fields.description.slice(0, 120) + '...'
                      : node.fields.description}
                  </p>
                )}

                {allFieldTags.length > 0 && (
                  <div className="node-card-tags">
                    {allFieldTags.slice(0, 5).map((tag) => (
                      <span
                        key={tag.id}
                        className="tag"
                        style={{ borderColor: `${tag.color}40`, color: tag.color, background: `${tag.color}12` }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {allFieldTags.length > 5 && (
                      <span className="tag" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
                        +{allFieldTags.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {childMap && (
                  <button
                    className="node-card-drill"
                    onClick={(e) => { e.stopPropagation(); drillDown(childMap.id); }}
                  >
                    <ArrowSquareIn size={14} /> Enter map
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
