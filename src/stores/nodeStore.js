import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { buildDefaultFields, buildDefaultStatusFlags } from '../utils/nodeSchemas';

/**
 * Node store — manages all nodes for the active campaign.
 */
const useNodeStore = create((set, get) => ({
  nodes: [],
  selectedNodeId: null,

  /** Load nodes for a campaign */
  loadNodes: (campaignId) => {
    const raw = localStorage.getItem(`flux_nodes_${campaignId}`);
    const nodes = raw ? JSON.parse(raw) : [];
    set({ nodes, selectedNodeId: null });
  },

  _persist: (campaignId) => {
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(get().nodes));
  },

  /** Create a node on a specific map at a position */
  createNode: (campaignId, mapId, nodeType, x, y) => {
    const fields = buildDefaultFields(nodeType);
    const node = {
      id: uuid(),
      campaignId,
      mapId,
      type: nodeType,
      x,
      y,
      fields,
      statusFlags: buildDefaultStatusFlags(nodeType),
      icon: null,        // null = use type default
      customIcon: null,   // user-uploaded icon data URL
      images: [],
      tagIds: [],
      drillDownTargets: [],
      createdAt: new Date().toISOString(),
    };
    const nodes = [...get().nodes, node];
    set({ nodes, selectedNodeId: node.id });
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));
    return node;
  },

  /** Update a node's position */
  moveNode: (campaignId, nodeId, x, y) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, x, y } : n
    );
    set({ nodes });
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));
  },

  /** Update a node's fields */
  updateNodeFields: (campaignId, nodeId, fieldUpdates) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, fields: { ...n.fields, ...fieldUpdates } } : n
    );
    set({ nodes });
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));
  },

  /** Update any top-level node property */
  updateNode: (campaignId, nodeId, updates) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, ...updates } : n
    );
    set({ nodes });
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));
  },

  /** Select a node */
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  /** Deselect */
  deselectNode: () => set({ selectedNodeId: null }),

  /** Get selected node */
  getSelectedNode: () => {
    const { nodes, selectedNodeId } = get();
    return nodes.find((n) => n.id === selectedNodeId) || null;
  },

  /** Get nodes for a specific map */
  getNodesForMap: (mapId) => {
    return get().nodes.filter((n) => n.mapId === mapId);
  },

  /** Delete a node */
  deleteNode: (campaignId, nodeId) => {
    const nodes = get().nodes.filter((n) => n.id !== nodeId);
    const selectedNodeId = get().selectedNodeId === nodeId ? null : get().selectedNodeId;
    set({ nodes, selectedNodeId });
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));
  },

  /** Add an image to a node */
  addNodeImage: (campaignId, nodeId, imageDataUrl) => {
    const nodes = get().nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, images: [...n.images, { id: uuid(), url: imageDataUrl, sortOrder: n.images.length }] };
    });
    set({ nodes });
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));
  },

  /** Remove an image from a node */
  removeNodeImage: (campaignId, nodeId, imageId) => {
    const nodes = get().nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, images: n.images.filter((img) => img.id !== imageId) };
    });
    set({ nodes });
    localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));
  },
}));

export default useNodeStore;
