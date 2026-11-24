import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, PanelLeft, Plus } from 'lucide-react';
import {
  ArchaeologyGraph,
  LayoutNode,
  ViewportState,
  VisualConfig,
} from '../types/graph';
import {
  createProjection,
  hitTestNode,
  renderGraphToCanvas,
} from '../engine/canvasRenderer';
import { GRAPH_PALETTES } from '../engine/palettes';

interface CanvasStageProps {
  graph: ArchaeologyGraph;
  config: VisualConfig;
  viewport: ViewportState;
  onViewportChange: React.Dispatch<React.SetStateAction<ViewportState>>;
  selectedNodeId: string | null;
  onSelectNode: (node: LayoutNode | null) => void;
  showLegend: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onResetViewport: () => void;
}

export function CanvasStage({
  graph,
  config,
  viewport,
  onViewportChange,
  selectedNodeId,
  onSelectNode,
  showLegend,
  sidebarOpen,
  onToggleSidebar,
  onResetViewport,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 960, height: 720 });
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    origPanX: 0,
    origPanY: 0,
    moved: false,
  });

  // Track container dimensions cleanly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render Canvas at device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderGraphToCanvas(
      ctx,
      graph,
      size.width,
      size.height,
      viewport,
      config,
      hoveredNode?.id ?? null,
      selectedNodeId,
      false
    );
  }, [graph, size, viewport, config, hoveredNode, selectedNodeId]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    onViewportChange((prev) => {
      const nextZoom = Math.max(0.45, Math.min(8, prev.zoom * factor));
      const scaleRatio = nextZoom / prev.zoom;
      const cx = size.width * 0.5;
      const cy = size.height * 0.5;
      const dx = sx - cx - prev.panX;
      const dy = sy - cy - prev.panY;
      return {
        zoom: nextZoom,
        panX: sx - cx - dx * scaleRatio,
        panY: sy - cy - dy * scaleRatio,
      };
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: viewport.panX,
      origPanY: viewport.panY,
      moved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true;
      }
      onViewportChange((prev) => ({
        ...prev,
        panX: dragRef.current.origPanX + dx,
        panY: dragRef.current.origPanY + dy,
      }));
      return;
    }

    const proj = createProjection(size.width, size.height, viewport);
    const w = proj.screenToWorld(sx, sy);
    setCursorWorld({ x: w.wx, y: w.wy });

    const hit = hitTestNode(graph, sx, sy, size.width, size.height, viewport);
    setHoveredNode(hit);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    setIsDragging(false);

    if (!wasMoved) {
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = hitTestNode(graph, sx, sy, size.width, size.height, viewport);
      onSelectNode(hit);
    }
  };

  const palette = GRAPH_PALETTES[config.paletteId];

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-hidden select-none"
      style={{ backgroundColor: palette.bgBase }}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setHoveredNode(null);
          setCursorWorld(null);
          dragRef.current.active = false;
          setIsDragging(false);
        }}
        style={{ width: size.width, height: size.height }}
        className={`block touch-none ${
          isDragging ? 'cursor-grabbing' : hoveredNode ? 'cursor-pointer' : 'cursor-crosshair'
        }`}
      />

      {/* Top-Left Unboxed Repository Identity & Inline Metadata */}
      <div className="pointer-events-none absolute top-5 left-5 max-w-md space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-white tracking-tight">
            {graph.owner} / {graph.repo}
          </h1>
        </div>
        <div className="flex items-center flex-wrap gap-x-2 text-xs font-mono text-slate-400">
          <span>
            {graph.mode === 'architecture' ? 'Code Architecture' : 'Git Commit History'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{graph.stats.spineSteps} steps</span>
          <span aria-hidden="true">·</span>
          <span>{graph.stats.branchCount} branches</span>
        </div>
      </div>

      {/* Hover Tooltip HUD */}
      {hoveredNode && !isDragging ? (
        <div className="pointer-events-none absolute top-5 right-5 max-w-xs px-3 py-2 bg-[#0b0c15]/90 border border-white/15 rounded-md">
          <div className="text-xs font-mono text-white truncate">{hoveredNode.label}</div>
          <div className="text-[11px] font-mono text-slate-400 truncate">
            {hoveredNode.category} · {hoveredNode.ref}
          </div>
        </div>
      ) : null}

      {/* Bottom-Left Signature Legend (matching @b1rkh0ff visual grammar) */}
      {showLegend ? (
        <div className="pointer-events-none absolute bottom-5 left-5 space-y-2 text-xs max-w-sm">
          <div className="flex items-center gap-3">
            <span
              className="w-7 h-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: palette.spineCore,
                boxShadow: `0 0 8px ${palette.uiAccent}`,
              }}
            />
            <span className="font-semibold text-white w-16 shrink-0">Trunk</span>
            <span className="text-slate-400 font-mono text-[11px] truncate">
              {graph.spineTitle}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <svg width="28" height="12" viewBox="0 0 28 12" className="shrink-0">
              <path
                d="M1 10 C 10 10, 14 2, 27 2"
                fill="none"
                stroke={palette.swatch}
                strokeWidth="1.6"
              />
            </svg>
            <span className="font-semibold text-white w-16 shrink-0">Branches</span>
            <span className="text-slate-400 font-mono text-[11px] truncate">
              {graph.branchTitle}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <svg width="28" height="12" viewBox="0 0 28 12" className="shrink-0">
              <path
                d="M2 8 L 11 4 M 16 9 L 25 3"
                fill="none"
                stroke="#7e62a8"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-semibold text-white w-16 shrink-0">Dust</span>
            <span className="text-slate-400 font-mono text-[11px] truncate">
              {graph.dustTitle}
            </span>
          </div>
        </div>
      ) : null}

      {/* Bottom-Right Compact Camera & Coordinate HUD */}
      <div className="absolute bottom-5 right-5 flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0b0c15]/90 border border-white/12 rounded-md text-[11px] font-mono text-slate-400">
          <span>
            {cursorWorld
              ? `X ${cursorWorld.x.toFixed(2)}  Y ${cursorWorld.y.toFixed(2)}`
              : 'X 0.00  Y 0.50'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-200">{Math.round(viewport.zoom * 100)}%</span>
        </div>

        <div className="flex items-center bg-[#0b0c15]/90 border border-white/12 rounded-md divide-x divide-white/10">
          <button
            type="button"
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide control panel' : 'Show control panel'}
            aria-label={sidebarOpen ? 'Hide control panel' : 'Show control panel'}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              onViewportChange((prev) => ({
                ...prev,
                zoom: Math.min(8, prev.zoom * 1.25),
              }))
            }
            title="Zoom in"
            aria-label="Zoom in"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              onViewportChange((prev) => ({
                ...prev,
                zoom: Math.max(0.45, prev.zoom * 0.8),
              }))
            }
            title="Zoom out"
            aria-label="Zoom out"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onResetViewport}
            title="Reset camera view"
            aria-label="Reset camera view"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
