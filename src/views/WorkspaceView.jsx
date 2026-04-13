import { useState, useCallback, useEffect } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import useCampaignStore from '../stores/campaignStore';
import useMapStore from '../stores/mapStore';
import useNodeStore from '../stores/nodeStore';
import useTagStore from '../stores/tagStore';
import useConnectionStore from '../stores/connectionStore';
import useSettingsStore from '../stores/settingsStore';
import useTerritoryStore from '../stores/territoryStore';
import MapSidebar from '../components/map/MapSidebar';
import MapToolbar from '../components/map/MapToolbar';
import MapCanvas from '../components/map/MapCanvas';
import DetailPanel from '../components/nodes/DetailPanel';
import CardPanel from '../components/map/CardPanel';
import SettingsPanel from '../components/settings/SettingsPanel';
import MapLegend from '../components/map/MapLegend';
import NodeContextMenu from '../components/map/NodeContextMenu';
import KanbanBoard from '../components/map/KanbanBoard';
import ImportModal from '../components/import/ImportModal';

export default function WorkspaceView() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);

  const loadMaps = useMapStore((s) => s.loadMaps);
  const loadNodes = useNodeStore((s) => s.loadNodes);
  const loadTags = useTagStore((s) => s.loadTags);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadTerritories = useTerritoryStore((s) => s.loadTerritories);

  // Settings-driven layout
  const layout = useSettingsStore((s) => s.layout);
  const mapSide = useSettingsStore((s) => s.mapSide);
  const showConnections = useSettingsStore((s) => s.showConnections);
  const settingsOpen = useSettingsStore((s) => s.settingsOpen);

  const [placingType, setPlacingType] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [kanbanMode, setKanbanMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { nodeId, x, y }

  const createConnection = useConnectionStore((s) => s.createConnection);

  // Load campaign data
  useEffect(() => {
    if (!campaignId) return;
    loadMaps(campaignId);
    loadNodes(campaignId);
    loadTags(campaignId);
    loadConnections(campaignId);
    loadSettings(campaignId);
    loadTerritories(campaignId);
  }, [campaignId, loadMaps, loadNodes, loadTags, loadConnections, loadSettings, loadTerritories]);

  const handlePlacingDone = useCallback(() => {
    setPlacingType(null);
  }, []);

  const handleConnectionClick = useCallback((nodeId) => {
    if (connectingFrom === '__waiting__') {
      setConnectingFrom(nodeId);
    } else if (connectingFrom && connectingFrom !== nodeId) {
      createConnection(campaignId, connectingFrom, nodeId);
      setConnectingFrom(null);
    }
  }, [connectingFrom, campaignId, createConnection]);

  const handleNodeContextMenu = useCallback((nodeId, viewportX, viewportY) => {
    setContextMenu({ nodeId, x: viewportX, y: viewportY });
  }, []);

  const handleStartConnect = useCallback((nodeId) => {
    setConnectingFrom(nodeId);
  }, []);

  const mapCanvas = (
    <MapCanvas
      placingType={placingType}
      onPlacingDone={handlePlacingDone}
      showConnections={showConnections}
      connectingFrom={connectingFrom}
      onConnectionClick={handleConnectionClick}
      onNodeContextMenu={handleNodeContextMenu}
      drawingMode={drawingMode}
      setDrawingMode={setDrawingMode}
    />
  );

  const rightPanel = selectedNodeId ? <DetailPanel /> : <CardPanel />;

  return (
    <div className="app-layout">
      <div className={`sidebar-shell ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <MapSidebar />
        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? 'Expand map list' : 'Collapse map list'}
        >
          {sidebarCollapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
        </button>
      </div>
      <div className="main-content">
        <MapToolbar
          placingType={placingType}
          setPlacingType={setPlacingType}
          connectingFrom={connectingFrom}
          setConnectingFrom={setConnectingFrom}
          kanbanMode={kanbanMode}
          setKanbanMode={setKanbanMode}
          onOpenImport={() => setImportOpen(true)}
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
        />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {kanbanMode ? (
            <KanbanBoard />
          ) : layout === 'full' ? (
            <>
              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {mapCanvas}
                <MapLegend />
              </div>
              {selectedNodeId && <DetailPanel />}
            </>
          ) : (
            <>
              {mapSide === 'left' ? (
                <>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {mapCanvas}
                    <MapLegend />
                  </div>
                  <div className="split-divider" />
                  {rightPanel}
                </>
              ) : (
                <>
                  {rightPanel}
                  <div className="split-divider" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {mapCanvas}
                    <MapLegend />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Connection mode indicator */}
      {connectingFrom && (
        <div className="connection-indicator">
          {connectingFrom === '__waiting__'
            ? 'Click the first node to connect...'
            : 'Now click the second node...'}
          <button
            className="btn-ghost btn-sm"
            onClick={() => setConnectingFrom(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onStartConnect={handleStartConnect}
        />
      )}

      {/* Import modal */}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}
