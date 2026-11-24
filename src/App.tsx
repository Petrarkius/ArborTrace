import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { ControlRail } from './components/ControlRail';
import { NodeInspector } from './components/NodeInspector';
import { TopBar } from './components/TopBar';
import { LLAMA_CPP_BASELINE } from './data/llamaCppBaseline';
import { exportPosterPng } from './engine/canvasRenderer';
import { buildArchaeologyGraph } from './engine/graphBuilder';
import { parseLocalFolder, parseUploadedFile } from './engine/localParser';
import {
  ArchaeologyMode,
  LayoutNode,
  RawRepoDataset,
  ViewportState,
  VisualConfig,
} from './types/graph';

const DEFAULT_CONFIG: VisualConfig = {
  paletteId: 'violet',
  spineJitter: 1.0,
  branchSpread: 1.0,
  glowIntensity: 1.05,
  dustDensity: 0.9,
  labelDensity: 1.0,
  showAnnotations: true,
  showGrid: false,
};

const DEFAULT_VIEWPORT: ViewportState = {
  panX: 0,
  panY: 0,
  zoom: 1,
};

export default function App() {
  const [dataset, setDataset] = useState<RawRepoDataset>(LLAMA_CPP_BASELINE);
  const [mode, setMode] = useState<ArchaeologyMode>('architecture');
  const [config, setConfig] = useState<VisualConfig>(DEFAULT_CONFIG);
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const repoSectionRef = useRef<HTMLDivElement>(null);
  const calibrationSectionRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(
    () => buildArchaeologyGraph(dataset, mode, config),
    [dataset, mode, config]
  );

  const selectedNode = selectedNodeId ? graph.nodeMap[selectedNodeId] ?? null : null;

  const resetViewport = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  const focusNode = useCallback(
    (node: LayoutNode) => {
      setSelectedNodeId(node.id);
      const el = stageWrapperRef.current;
      const w = el ? el.clientWidth : 960;
      const h = el ? el.clientHeight : 720;
      const nextZoom = Math.max(viewport.zoom, 1.55);
      const baseScale = Math.min(w * 0.44, h * 0.48);
      const scale = baseScale * nextZoom;
      setViewport({
        zoom: nextZoom,
        panX: -node.x * scale,
        panY: -(node.y - 0.5) * (scale * 1.92),
      });
    },
    [viewport.zoom]
  );

  // Keyboard shortcuts for camera & inspector
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      } else if (e.key === '0') {
        resetViewport();
      } else if (e.key === '=' || e.key === '+') {
        setViewport((prev) => ({ ...prev, zoom: Math.min(8, prev.zoom * 1.2) }));
      } else if (e.key === '-') {
        setViewport((prev) => ({ ...prev, zoom: Math.max(0.45, prev.zoom * 0.85) }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetViewport]);

  const handleLoadGitHubRepo = useCallback(async (owner: string, repo: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSelectedNodeId(null);
    try {
      const res = await fetch(
        `/api/github/analyze?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || `Failed to load ${owner}/${repo}`);
      }
      setDataset(body as RawRepoDataset);
      setViewport(DEFAULT_VIEWPORT);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to fetch GitHub repository.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadBaseline = useCallback(() => {
    setErrorMsg(null);
    setSelectedNodeId(null);
    setDataset(LLAMA_CPP_BASELINE);
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  const handleUploadFolder = useCallback(async (files: FileList) => {
    setLoading(true);
    setErrorMsg(null);
    setSelectedNodeId(null);
    try {
      const parsed = await parseLocalFolder(files);
      setDataset(parsed);
      setViewport(DEFAULT_VIEWPORT);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to parse local repository folder.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    setSelectedNodeId(null);
    try {
      const parsed = await parseUploadedFile(file);
      setDataset(parsed);
      if (parsed.sourceKind === 'local-gitlog') {
        setMode('history');
      }
      setViewport(DEFAULT_VIEWPORT);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to parse uploaded file.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExportPng = useCallback(() => {
    setExporting(true);
    requestAnimationFrame(() => {
      try {
        exportPosterPng(graph, config);
      } finally {
        setExporting(false);
      }
    });
  }, [graph, config]);

  const handleSelectView = useCallback(
    (target: 'explorer' | 'repository' | 'calibration' | 'legend') => {
      if (target === 'explorer') {
        setSidebarOpen((prev) => !prev);
      } else if (target === 'repository') {
        setSidebarOpen(true);
        requestAnimationFrame(() => {
          repoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else if (target === 'calibration') {
        setSidebarOpen(true);
        requestAnimationFrame(() => {
          calibrationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else if (target === 'legend') {
        setShowLegend((prev) => !prev);
      }
    },
    []
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#06060c] text-slate-100">
      <TopBar
        paletteId={config.paletteId}
        sidebarOpen={sidebarOpen}
        showLegend={showLegend}
        onSelectView={handleSelectView}
        onExportPng={handleExportPng}
        exporting={exporting}
      />

      <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {sidebarOpen ? (
          <ControlRail
            graph={graph}
            mode={mode}
            onModeChange={(nextMode) => {
              setMode(nextMode);
              setSelectedNodeId(null);
            }}
            config={config}
            onConfigChange={setConfig}
            onResetConfig={() => setConfig(DEFAULT_CONFIG)}
            onLoadGitHubRepo={handleLoadGitHubRepo}
            onLoadBaseline={handleLoadBaseline}
            onUploadFolder={handleUploadFolder}
            onUploadFile={handleUploadFile}
            loading={loading}
            errorMsg={errorMsg}
            onSelectNode={focusNode}
            activeSectionRef={repoSectionRef}
            calibrationRef={calibrationSectionRef}
          />
        ) : null}

        <div ref={stageWrapperRef} className="flex-1 min-w-0 h-full flex overflow-hidden">
          <CanvasStage
            graph={graph}
            config={config}
            viewport={viewport}
            onViewportChange={setViewport}
            selectedNodeId={selectedNodeId}
            onSelectNode={(node) => setSelectedNodeId(node?.id ?? null)}
            showLegend={showLegend}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            onResetViewport={resetViewport}
          />

          {selectedNode ? (
            <NodeInspector
              graph={graph}
              node={selectedNode}
              onClose={() => setSelectedNodeId(null)}
              onJumpToNode={focusNode}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
