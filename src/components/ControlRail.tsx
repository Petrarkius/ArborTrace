import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  FolderUp,
  GitBranch,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  ArchaeologyGraph,
  ArchaeologyMode,
  LayoutNode,
  PaletteId,
  VisualConfig,
} from '../types/graph';
import { GRAPH_PALETTES } from '../engine/palettes';

interface ControlRailProps {
  graph: ArchaeologyGraph;
  mode: ArchaeologyMode;
  onModeChange: (mode: ArchaeologyMode) => void;
  config: VisualConfig;
  onConfigChange: (next: VisualConfig) => void;
  onResetConfig: () => void;
  onLoadGitHubRepo: (owner: string, repo: string) => Promise<void>;
  onLoadBaseline: () => void;
  onUploadFolder: (files: FileList) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  loading: boolean;
  errorMsg: string | null;
  onSelectNode: (node: LayoutNode) => void;
  activeSectionRef?: React.RefObject<HTMLDivElement | null>;
  calibrationRef?: React.RefObject<HTMLDivElement | null>;
}

const PRESET_REPOS = [
  { owner: 'ggml-org', repo: 'llama.cpp', label: 'ggml-org/llama.cpp', isBaseline: true },
  { owner: 'ggerganov', repo: 'whisper.cpp', label: 'ggerganov/whisper.cpp', isBaseline: false },
  { owner: 'facebook', repo: 'react', label: 'facebook/react', isBaseline: false },
  { owner: 'expressjs', repo: 'express', label: 'expressjs/express', isBaseline: false },
];

export function ControlRail({
  graph,
  mode,
  onModeChange,
  config,
  onConfigChange,
  onResetConfig,
  onLoadGitHubRepo,
  onLoadBaseline,
  onUploadFolder,
  onUploadFile,
  loading,
  errorMsg,
  onSelectNode,
  activeSectionRef,
  calibrationRef,
}: ControlRailProps) {
  const [repoInput, setRepoInput] = useState(`${graph.owner}/${graph.repo}`);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const palette = GRAPH_PALETTES[config.paletteId];

  const handleGitHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = repoInput
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '');
    const parts = cleaned.split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return;
    }
    await onLoadGitHubRepo(parts[0], parts[1]);
  };

  const handleCopyGitCmd = () => {
    const cmd = 'git log --format="%H|%P|%at|%an|%s" -n 400 > gitlog.txt';
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1800);
    });
  };

  const searchResults = searchQuery.trim()
    ? graph.nodes
        .filter((n) => {
          const q = searchQuery.toLowerCase();
          return (
            n.label.toLowerCase().includes(q) ||
            n.ref.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q)
          );
        })
        .slice(0, 14)
    : [];

  return (
    <aside className="w-full md:w-[340px] shrink-0 h-full overflow-y-auto bg-[#0b0c15] border-r border-white/10 flex flex-col divide-y divide-white/10">
      {/* 01. Repository Source */}
      <section ref={activeSectionRef} className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            01. Repository Source
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {graph.sourceKind === 'baseline'
              ? 'Curated'
              : graph.sourceKind === 'github'
                ? 'Live GitHub'
                : 'Local Upload'}
          </span>
        </div>

        <form onSubmit={handleGitHubSubmit} className="flex gap-2">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo (e.g. ggml-org/llama.cpp)"
            aria-label="GitHub repository owner and name"
            className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-[#06060c] border border-white/15 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-md border border-white/15 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>{loading ? 'Loading' : 'Analyze'}</span>
          </button>
        </form>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_REPOS.map((preset) => {
            const isCurrent =
              graph.owner.toLowerCase() === preset.owner.toLowerCase() &&
              graph.repo.toLowerCase() === preset.repo.toLowerCase();
            return (
              <button
                key={preset.label}
                type="button"
                disabled={loading}
                onClick={() => {
                  setRepoInput(preset.label);
                  if (preset.isBaseline) {
                    onLoadBaseline();
                  } else {
                    onLoadGitHubRepo(preset.owner, preset.repo);
                  }
                }}
                className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-white/12 border-white/30 text-white'
                    : 'bg-[#06060c] border-white/10 text-slate-400 hover:text-slate-100 hover:border-white/25'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setRepoInput('ggml-org/llama.cpp');
              onLoadGitHubRepo('ggml-org', 'llama.cpp');
            }}
            className="px-2.5 py-1 text-[11px] font-mono rounded border bg-[#06060c] border-white/10 text-slate-400 hover:text-slate-100 hover:border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Fetch live tree & commits from GitHub for ggml-org/llama.cpp"
          >
            Live llama.cpp
          </button>
        </div>

        {/* Local Repo / Git Log Upload */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            // @ts-expect-error webkitdirectory is standard in modern browsers for directory upload
            webkitdirectory=""
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadFolder(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#06060c] hover:bg-white/5 text-slate-200 border border-white/12 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderUp className="w-3.5 h-3.5 text-slate-400" />
            <span>Upload Folder</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.log,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onUploadFile(f);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#06060c] hover:bg-white/5 text-slate-200 border border-white/12 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Git Log / JSON</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
          <span className="truncate pr-2">Export local git log command</span>
          <button
            type="button"
            onClick={handleCopyGitCmd}
            className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-white cursor-pointer shrink-0"
          >
            {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copiedCmd ? 'Copied' : 'Copy CLI'}</span>
          </button>
        </div>

        {errorMsg ? (
          <div className="p-2.5 text-xs text-rose-200 bg-rose-950/40 border border-rose-500/30 rounded-md leading-relaxed">
            {errorMsg}
          </div>
        ) : null}
      </section>

      {/* 02. Archaeology Mode */}
      <section className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            02. Archaeology Mapping
          </h2>
          <GitBranch className="w-3.5 h-3.5 text-slate-400" />
        </div>

        <div className="grid grid-cols-2 p-1 bg-[#06060c] border border-white/10 rounded-md gap-1">
          <button
            type="button"
            onClick={() => onModeChange('architecture')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'architecture'
                ? 'bg-white/14 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Code Architecture
          </button>
          <button
            type="button"
            onClick={() => onModeChange('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'history'
                ? 'bg-white/14 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Git History
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono flex items-center flex-wrap gap-x-2 gap-y-1">
          <span>{graph.stats.spineSteps} spine</span>
          <span aria-hidden="true">·</span>
          <span>{graph.stats.branchCount} branches</span>
          <span aria-hidden="true">·</span>
          <span>{graph.stats.dustCount} dust</span>
        </div>
      </section>

      {/* 03. Palette & Filament Calibration */}
      <section ref={calibrationRef} className="p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            03. Filament Calibration
          </h2>
          <button
            type="button"
            onClick={onResetConfig}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Palette Swatches */}
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(GRAPH_PALETTES) as PaletteId[]).map((pid) => {
            const p = GRAPH_PALETTES[pid];
            const active = config.paletteId === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => onConfigChange({ ...config, paletteId: pid })}
                className={`flex items-center gap-2 px-2.5 py-2 text-xs rounded-md border transition-colors text-left cursor-pointer ${
                  active
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'bg-[#06060c] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.swatch }}
                />
                <span className="truncate">{p.name.split(' ')[1] || p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Sliders */}
        <div className="space-y-3 pt-1">
          <SliderControl
            label="Spine Branch Pull"
            value={config.spineJitter}
            min={0}
            max={2.4}
            step={0.1}
            accent={palette.uiAccent}
            display={config.spineJitter.toFixed(1)}
            onChange={(v) => onConfigChange({ ...config, spineJitter: v })}
          />
          <SliderControl
            label="Branch Spread"
            value={config.branchSpread}
            min={0.5}
            max={1.8}
            step={0.05}
            accent={palette.uiAccent}
            display={`${Math.round(config.branchSpread * 100)}%`}
            onChange={(v) => onConfigChange({ ...config, branchSpread: v })}
          />
          <SliderControl
            label="Glow Intensity"
            value={config.glowIntensity}
            min={0.4}
            max={1.8}
            step={0.05}
            accent={palette.uiAccent}
            display={`${Math.round(config.glowIntensity * 100)}%`}
            onChange={(v) => onConfigChange({ ...config, glowIntensity: v })}
          />
          <SliderControl
            label="Dust Density"
            value={config.dustDensity}
            min={0}
            max={1}
            step={0.05}
            accent={palette.uiAccent}
            display={`${Math.round(config.dustDensity * 100)}%`}
            onChange={(v) => onConfigChange({ ...config, dustDensity: v })}
          />
          <SliderControl
            label="Label Density"
            value={config.labelDensity}
            min={0.2}
            max={1.5}
            step={0.1}
            accent={palette.uiAccent}
            display={`${Math.round(config.labelDensity * 100)}%`}
            onChange={(v) => onConfigChange({ ...config, labelDensity: v })}
          />
        </div>

        {/* Layer Visibility Toggles */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              onConfigChange({ ...config, showAnnotations: !config.showAnnotations })
            }
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              config.showAnnotations
                ? 'bg-white/12 border-white/25 text-white'
                : 'bg-[#06060c] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            Callout Labels
          </button>
          <button
            type="button"
            onClick={() => onConfigChange({ ...config, showGrid: !config.showGrid })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              config.showGrid
                ? 'bg-white/12 border-white/25 text-white'
                : 'bg-[#06060c] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            Coordinate Grid
          </button>
        </div>
      </section>

      {/* 04. Node Search */}
      <section className="p-4 space-y-2.5 flex-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            04. Node Search
          </h2>
          <Sparkles className="w-3.5 h-3.5 text-slate-400 opacity-0" aria-hidden="true" />
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter symbols, files, commits..."
            aria-label="Search graph nodes"
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#06060c] border border-white/15 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-white/40"
          />
        </div>

        {searchQuery.trim() ? (
          <div className="space-y-1 max-h-52 overflow-y-auto pt-1">
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No matching nodes found.</p>
            ) : (
              searchResults.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node)}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/8 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="text-xs font-mono text-slate-200 truncate">
                    {node.label}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    {node.kind}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            Click any glowing node or callout on the canvas to inspect dependencies, commit hashes, or file paths.
          </p>
        )}
      </section>
    </aside>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  accent: string;
  onChange: (val: number) => void;
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  display,
  accent,
  onChange,
}: SliderControlProps) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: accent }}
        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
      />
    </label>
  );
}
