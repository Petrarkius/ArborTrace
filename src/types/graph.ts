export type ArchaeologyMode = 'architecture' | 'history';

export type PaletteId = 'violet' | 'cyan' | 'ember' | 'emerald';

export type DataSourceKind = 'baseline' | 'github' | 'local-folder' | 'local-gitlog' | 'local-json';

export interface RawSpineItem {
  id: string;
  label: string;
  subtitle?: string;
  category: string;
  /** File path or commit SHA */
  ref: string;
  author?: string;
  timestamp?: string;
  description?: string;
  /** Optional external link */
  url?: string;
  /** Key milestone highlighted with a horizontal callout annotation */
  featured?: boolean;
  /** Preferred side for label placement if featured */
  labelSide?: 'left' | 'right';
}

export interface RawBranchItem {
  id: string;
  label: string;
  category: string;
  ref: string;
  /** Spine item ID where this branch sprouts from */
  fromSpineId: string;
  /** Spine item ID where this branch converges back (optional) */
  toSpineId?: string;
  /** Optional parent branch ID for nested secondary filaments */
  parentBranchId?: string;
  side?: 'left' | 'right';
  depth?: number;
  author?: string;
  timestamp?: string;
  description?: string;
  url?: string;
  featured?: boolean;
}

export interface RawDustItem {
  id: string;
  label: string;
  category: string;
  ref: string;
  description?: string;
  url?: string;
}

export interface RawRepoDataset {
  owner: string;
  repo: string;
  description: string;
  defaultBranch: string;
  stars?: number;
  sourceKind: DataSourceKind;
  fetchedAt: string;
  architecture: {
    spineTitle: string;
    branchTitle: string;
    dustTitle: string;
    totalFiles: number;
    spine: RawSpineItem[];
    branches: RawBranchItem[];
    dust: RawDustItem[];
  };
  history: {
    spineTitle: string;
    branchTitle: string;
    dustTitle: string;
    totalCommits: number;
    spine: RawSpineItem[];
    branches: RawBranchItem[];
    dust: RawDustItem[];
  };
}

export interface LayoutNode {
  id: string;
  kind: 'spine' | 'branch' | 'dust';
  label: string;
  subtitle?: string;
  category: string;
  ref: string;
  author?: string;
  timestamp?: string;
  description?: string;
  url?: string;
  /** Normalized world coordinate in [-1, 1] horizontally, [0, 1] vertically */
  x: number;
  y: number;
  /** Visual radius in world units */
  radius: number;
  /** Index along the spine (for spine nodes) */
  spineIndex?: number;
  /** Connected node IDs for inspector navigation */
  connectedIds: string[];
  featured: boolean;
}

export interface LayoutEdge {
  id: string;
  kind: 'spine' | 'branch' | 'subbranch';
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  x2: number;
  y2: number;
  intensity: number;
}

export interface LayoutDustStroke {
  id: string;
  nodeId: string;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
  alpha: number;
}

export interface GraphAnnotation {
  nodeId: string;
  label: string;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  side: 'left' | 'right';
}

export interface ArchaeologyGraph {
  owner: string;
  repo: string;
  description: string;
  mode: ArchaeologyMode;
  sourceKind: DataSourceKind;
  spineTitle: string;
  branchTitle: string;
  dustTitle: string;
  stats: {
    spineSteps: number;
    branchCount: number;
    dustCount: number;
    totalFilesOrCommits: number;
  };
  nodes: LayoutNode[];
  nodeMap: Record<string, LayoutNode>;
  edges: LayoutEdge[];
  dustStrokes: LayoutDustStroke[];
  annotations: GraphAnnotation[];
}

export interface VisualConfig {
  paletteId: PaletteId;
  spineJitter: number;
  branchSpread: number;
  glowIntensity: number;
  dustDensity: number;
  labelDensity: number;
  showAnnotations: boolean;
  showGrid: boolean;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}
