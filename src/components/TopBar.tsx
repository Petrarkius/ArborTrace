import { Download } from 'lucide-react';
import { PaletteId } from '../types/graph';
import { GRAPH_PALETTES } from '../engine/palettes';

export type RailSection = 'repository' | 'calibration' | 'search';

interface TopBarProps {
  paletteId: PaletteId;
  sidebarOpen: boolean;
  showLegend: boolean;
  onSelectView: (target: 'explorer' | 'repository' | 'calibration' | 'legend') => void;
  onExportPng: () => void;
  exporting: boolean;
}

export function TopBar({
  paletteId,
  sidebarOpen,
  showLegend,
  onSelectView,
  onExportPng,
  exporting,
}: TopBarProps) {
  const palette = GRAPH_PALETTES[paletteId];

  return (
    <header className="h-[52px] shrink-0 flex items-center justify-between gap-8 px-5 bg-[#090a12] border-b border-white/10">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => onSelectView('explorer')}
        className="text-base font-semibold tracking-tight text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
      >
        ArborTrace
      </button>

      {/* Zone 2: 4 concise single-line navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
        <button
          type="button"
          onClick={() => onSelectView('explorer')}
          className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
            !sidebarOpen
              ? 'text-white border-white/70'
              : 'border-transparent hover:text-slate-100'
          }`}
        >
          Explorer
        </button>
        <button
          type="button"
          onClick={() => onSelectView('repository')}
          className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:text-slate-100 transition-colors cursor-pointer"
        >
          Repository
        </button>
        <button
          type="button"
          onClick={() => onSelectView('calibration')}
          className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:text-slate-100 transition-colors cursor-pointer"
        >
          Calibration
        </button>
        <button
          type="button"
          onClick={() => onSelectView('legend')}
          className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
            showLegend
              ? 'text-slate-100 border-white/40'
              : 'border-transparent hover:text-slate-100'
          }`}
        >
          Legend
        </button>
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onExportPng}
          disabled={exporting}
          style={{
            backgroundColor: palette.uiAccentMuted,
            borderColor: palette.uiAccent,
          }}
          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white border rounded-md hover:brightness-110 transition-all whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exporting ? 'Rendering...' : 'Export PNG'}</span>
        </button>
      </div>
    </header>
  );
}
