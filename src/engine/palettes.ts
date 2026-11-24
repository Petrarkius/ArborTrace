import { PaletteId } from '../types/graph';

export interface GraphPalette {
  id: PaletteId;
  name: string;
  swatch: string;
  bgBase: string;
  bgAuraTop: string;
  bgAuraCenter: string;
  spineHaloOuter: string;
  spineHaloMid: string;
  spineFilament: string;
  spineCore: string;
  branchOuter: string;
  branchInner: string;
  branchHighlight: string;
  subBranch: string;
  dustStroke: string;
  guideLine: string;
  labelText: string;
  labelHighlight: string;
  uiAccent: string;
  uiAccentMuted: string;
}

export const GRAPH_PALETTES: Record<PaletteId, GraphPalette> = {
  violet: {
    id: 'violet',
    name: 'Bioluminescent Violet',
    swatch: '#d946ef',
    bgBase: '#06060c',
    bgAuraTop: 'rgba(192, 38, 211, 0.22)',
    bgAuraCenter: 'rgba(139, 92, 246, 0.08)',
    spineHaloOuter: 'rgba(147, 51, 234, 0.14)',
    spineHaloMid: 'rgba(217, 70, 239, 0.36)',
    spineFilament: 'rgba(240, 171, 252, 0.72)',
    spineCore: 'rgba(255, 247, 255, 0.96)',
    branchOuter: 'rgba(168, 85, 247, 0.22)',
    branchInner: 'rgba(232, 121, 249, 0.56)',
    branchHighlight: '#fdf4ff',
    subBranch: 'rgba(192, 132, 252, 0.28)',
    dustStroke: 'rgba(126, 98, 168, 0.32)',
    guideLine: 'rgba(196, 165, 238, 0.36)',
    labelText: '#d9c8f2',
    labelHighlight: '#ffffff',
    uiAccent: '#d946ef',
    uiAccentMuted: 'rgba(217, 70, 239, 0.16)',
  },
  cyan: {
    id: 'cyan',
    name: 'Phosphor Cyan',
    swatch: '#06b6d4',
    bgBase: '#05080f',
    bgAuraTop: 'rgba(6, 182, 212, 0.20)',
    bgAuraCenter: 'rgba(37, 99, 235, 0.08)',
    spineHaloOuter: 'rgba(8, 145, 178, 0.14)',
    spineHaloMid: 'rgba(34, 211, 238, 0.36)',
    spineFilament: 'rgba(165, 243, 252, 0.72)',
    spineCore: 'rgba(240, 253, 255, 0.96)',
    branchOuter: 'rgba(14, 165, 233, 0.22)',
    branchInner: 'rgba(56, 189, 248, 0.54)',
    branchHighlight: '#ecfeff',
    subBranch: 'rgba(103, 232, 249, 0.26)',
    dustStroke: 'rgba(88, 134, 164, 0.32)',
    guideLine: 'rgba(148, 210, 235, 0.34)',
    labelText: '#bde8f5',
    labelHighlight: '#ffffff',
    uiAccent: '#22d3ee',
    uiAccentMuted: 'rgba(34, 211, 238, 0.16)',
  },
  ember: {
    id: 'ember',
    name: 'Solar Ember',
    swatch: '#f59e0b',
    bgBase: '#090607',
    bgAuraTop: 'rgba(245, 158, 11, 0.20)',
    bgAuraCenter: 'rgba(225, 29, 72, 0.07)',
    spineHaloOuter: 'rgba(217, 119, 6, 0.15)',
    spineHaloMid: 'rgba(251, 146, 60, 0.36)',
    spineFilament: 'rgba(253, 224, 71, 0.70)',
    spineCore: 'rgba(255, 251, 235, 0.96)',
    branchOuter: 'rgba(234, 88, 12, 0.22)',
    branchInner: 'rgba(251, 191, 36, 0.52)',
    branchHighlight: '#fffbeb',
    subBranch: 'rgba(249, 115, 22, 0.26)',
    dustStroke: 'rgba(164, 112, 88, 0.32)',
    guideLine: 'rgba(235, 188, 148, 0.34)',
    labelText: '#f5dec2',
    labelHighlight: '#ffffff',
    uiAccent: '#f59e0b',
    uiAccentMuted: 'rgba(245, 158, 11, 0.16)',
  },
  emerald: {
    id: 'emerald',
    name: 'Abyssal Emerald',
    swatch: '#10b981',
    bgBase: '#050a08',
    bgAuraTop: 'rgba(16, 185, 129, 0.20)',
    bgAuraCenter: 'rgba(20, 184, 166, 0.08)',
    spineHaloOuter: 'rgba(5, 150, 105, 0.15)',
    spineHaloMid: 'rgba(52, 211, 153, 0.36)',
    spineFilament: 'rgba(167, 243, 208, 0.72)',
    spineCore: 'rgba(236, 253, 245, 0.96)',
    branchOuter: 'rgba(20, 184, 166, 0.22)',
    branchInner: 'rgba(52, 211, 153, 0.54)',
    branchHighlight: '#ecfdf5',
    subBranch: 'rgba(94, 234, 212, 0.26)',
    dustStroke: 'rgba(84, 148, 126, 0.32)',
    guideLine: 'rgba(148, 224, 194, 0.34)',
    labelText: '#c1f0dc',
    labelHighlight: '#ffffff',
    uiAccent: '#10b981',
    uiAccentMuted: 'rgba(16, 185, 129, 0.16)',
  },
};
