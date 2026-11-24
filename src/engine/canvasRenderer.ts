import {
  ArchaeologyGraph,
  LayoutNode,
  ViewportState,
  VisualConfig,
} from '../types/graph';
import { GRAPH_PALETTES, GraphPalette } from './palettes';

export interface ScreenProjection {
  worldToScreen: (wx: number, wy: number) => { sx: number; sy: number };
  screenToWorld: (sx: number, sy: number) => { wx: number; wy: number };
  scale: number;
}

export function createProjection(
  width: number,
  height: number,
  viewport: ViewportState
): ScreenProjection {
  const baseScale = Math.min(width * 0.44, height * 0.48);
  const scale = baseScale * viewport.zoom;
  const centerX = width * 0.5 + viewport.panX;
  const centerY = height * 0.5 + viewport.panY;

  return {
    scale,
    worldToScreen(wx: number, wy: number) {
      return {
        sx: centerX + wx * scale,
        sy: centerY + (wy - 0.5) * (scale * 1.92),
      };
    },
    screenToWorld(sx: number, sy: number) {
      return {
        wx: (sx - centerX) / scale,
        wy: (sy - centerY) / (scale * 1.92) + 0.5,
      };
    },
  };
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function cubicPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

export function hitTestNode(
  graph: ArchaeologyGraph,
  sx: number,
  sy: number,
  width: number,
  height: number,
  viewport: ViewportState
): LayoutNode | null {
  const proj = createProjection(width, height, viewport);
  let bestNode: LayoutNode | null = null;
  let bestDist = 18;

  // 1. Direct node point hit check (tight radius so junction & spine nodes stay precise)
  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const p = proj.worldToScreen(node.x, node.y);
    const dist = Math.hypot(p.sx - sx, p.sy - sy);
    const threshold = node.kind === 'spine' ? 12 : node.kind === 'branch' ? 10 : 8;
    if (dist < threshold && dist < bestDist) {
      bestDist = dist;
      bestNode = node;
    }
  }

  // If cursor is directly on a node center, return immediately
  if (bestNode && bestDist <= 9) {
    return bestNode;
  }

  // 2. Full-curve hit testing across branch & sub-branch cubic Bezier edges
  const curveThreshold = 10;
  let bestEdgeNode: LayoutNode | null = null;
  let bestEdgeDist = curveThreshold;
  const steps = 10;

  for (let i = 0; i < graph.edges.length; i++) {
    const e = graph.edges[i];
    if (e.kind === 'spine') continue;

    const p1 = proj.worldToScreen(e.x1, e.y1);
    const pc1 = proj.worldToScreen(e.cx1, e.cy1);
    const pc2 = proj.worldToScreen(e.cx2, e.cy2);
    const p2 = proj.worldToScreen(e.x2, e.y2);

    // Convex-hull AABB pre-filter
    const minX = Math.min(p1.sx, pc1.sx, pc2.sx, p2.sx) - curveThreshold;
    const maxX = Math.max(p1.sx, pc1.sx, pc2.sx, p2.sx) + curveThreshold;
    if (sx < minX || sx > maxX) continue;

    const minY = Math.min(p1.sy, pc1.sy, pc2.sy, p2.sy) - curveThreshold;
    const maxY = Math.max(p1.sy, pc1.sy, pc2.sy, p2.sy) + curveThreshold;
    if (sy < minY || sy > maxY) continue;

    // Sample curve into polyline segments and measure closest distance
    let prevX = p1.sx;
    let prevY = p1.sy;
    let minEdgeDist = Infinity;

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const curX = cubicPoint(p1.sx, pc1.sx, pc2.sx, p2.sx, t);
      const curY = cubicPoint(p1.sy, pc1.sy, pc2.sy, p2.sy, t);
      const d = distPointToSegment(sx, sy, prevX, prevY, curX, curY);
      if (d < minEdgeDist) minEdgeDist = d;
      prevX = curX;
      prevY = curY;
    }

    if (minEdgeDist < bestEdgeDist) {
      const toNode = graph.nodeMap[e.toId];
      const fromNode = graph.nodeMap[e.fromId];
      const targetNode =
        e.kind === 'subbranch'
          ? toNode
          : toNode?.kind === 'branch'
            ? toNode
            : fromNode?.kind === 'branch'
              ? fromNode
              : toNode;

      if (targetNode) {
        bestEdgeDist = minEdgeDist;
        bestEdgeNode = targetNode;
      }
    }
  }

  if (bestEdgeNode) {
    return bestEdgeNode;
  }

  if (bestNode) {
    return bestNode;
  }

  // 3. Fallback: dust stroke segments
  const dustThreshold = 8;
  let bestDustNode: LayoutNode | null = null;
  let bestDustDist = dustThreshold;

  for (let i = 0; i < graph.dustStrokes.length; i++) {
    const ds = graph.dustStrokes[i];
    const p1 = proj.worldToScreen(ds.x1, ds.y1);
    const p2 = proj.worldToScreen(ds.x2, ds.y2);
    const minX = Math.min(p1.sx, p2.sx) - dustThreshold;
    const maxX = Math.max(p1.sx, p2.sx) + dustThreshold;
    const minY = Math.min(p1.sy, p2.sy) - dustThreshold;
    const maxY = Math.max(p1.sy, p2.sy) + dustThreshold;
    if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;

    const d = distPointToSegment(sx, sy, p1.sx, p1.sy, p2.sx, p2.sy);
    if (d < bestDustDist) {
      const n = graph.nodeMap[ds.nodeId];
      if (n) {
        bestDustDist = d;
        bestDustNode = n;
      }
    }
  }

  return bestDustNode;
}

export function renderGraphToCanvas(
  ctx: CanvasRenderingContext2D,
  graph: ArchaeologyGraph,
  width: number,
  height: number,
  viewport: ViewportState,
  config: VisualConfig,
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  isExport = false
): void {
  const palette: GraphPalette = GRAPH_PALETTES[config.paletteId];
  const proj = createProjection(width, height, viewport);
  const glow = config.glowIntensity;

  // 1. Pitch Obsidian Base Background
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = palette.bgBase;
  ctx.fillRect(0, 0, width, height);

  // Subtle atmospheric bioluminescent aura behind top root bulb & central spine
  const topRoot = graph.nodes[0];
  if (topRoot) {
    const topPos = proj.worldToScreen(topRoot.x, topRoot.y);
    const topAura = ctx.createRadialGradient(
      topPos.sx,
      topPos.sy,
      2,
      topPos.sx,
      topPos.sy,
      Math.max(120, proj.scale * 0.55)
    );
    topAura.addColorStop(0, palette.bgAuraTop);
    topAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topAura;
    ctx.fillRect(0, 0, width, height);
  }

  const centerPos = proj.worldToScreen(0, 0.5);
  const spineAura = ctx.createRadialGradient(
    centerPos.sx,
    centerPos.sy,
    10,
    centerPos.sx,
    centerPos.sy,
    Math.max(240, proj.scale * 1.1)
  );
  spineAura.addColorStop(0, palette.bgAuraCenter);
  spineAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spineAura;
  ctx.fillRect(0, 0, width, height);

  // Optional scientific calibration coordinate grid
  if (config.showGrid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 0.25;
    for (let gx = -1; gx <= 1; gx += step) {
      const pTop = proj.worldToScreen(gx, 0.02);
      const pBot = proj.worldToScreen(gx, 0.98);
      ctx.beginPath();
      ctx.moveTo(pTop.sx, pTop.sy);
      ctx.lineTo(pBot.sx, pBot.sy);
      ctx.stroke();
    }
    for (let gy = 0.1; gy <= 0.95; gy += 0.1) {
      const pLeft = proj.worldToScreen(-1, gy);
      const pRight = proj.worldToScreen(1, gy);
      ctx.beginPath();
      ctx.moveTo(pLeft.sx, pLeft.sy);
      ctx.lineTo(pRight.sx, pRight.sy);
      ctx.stroke();
    }
  }

  // Determine active neighborhood if hovering or selecting a node
  const focusId = selectedNodeId || hoveredNodeId;
  const focusNode = focusId ? graph.nodeMap[focusId] : null;
  const focusSet = new Set<string>();
  if (focusNode) {
    focusSet.add(focusNode.id);
    focusNode.connectedIds.forEach((cid) => focusSet.add(cid));
  }

  const zoomLineScale = Math.max(0.7, Math.min(2.2, Math.sqrt(viewport.zoom)));
  const exportScale = isExport ? width / 1200 : 1;
  const lwMult = zoomLineScale * exportScale;

  // 2. Render Dust Layer (unreached files / stale branches)
  ctx.lineCap = 'round';
  for (let i = 0; i < graph.dustStrokes.length; i++) {
    const ds = graph.dustStrokes[i];
    const p1 = proj.worldToScreen(ds.x1, ds.y1);
    const pc = proj.worldToScreen(ds.cx, ds.cy);
    const p2 = proj.worldToScreen(ds.x2, ds.y2);

    if (
      p1.sx < -40 ||
      p1.sx > width + 40 ||
      p1.sy < -40 ||
      p1.sy > height + 40
    ) {
      continue;
    }

    const isFocused = focusNode?.id === ds.nodeId;
    ctx.strokeStyle = isFocused ? palette.branchHighlight : palette.dustStroke;
    ctx.globalAlpha = isFocused ? 0.95 : ds.alpha * (focusNode ? 0.45 : 0.85);
    ctx.lineWidth = (isFocused ? 2.2 : 0.9) * lwMult;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.quadraticCurveTo(pc.sx, pc.sy, p2.sx, p2.sy);
    ctx.stroke();
  }

  // 3. Switch to Additive Blending ('lighter') for authentic bioluminescent glow
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;

  // 3A. Branches & Sub-branches
  for (let i = 0; i < graph.edges.length; i++) {
    const e = graph.edges[i];
    if (e.kind === 'spine') continue;

    const p1 = proj.worldToScreen(e.x1, e.y1);
    const pc1 = proj.worldToScreen(e.cx1, e.cy1);
    const pc2 = proj.worldToScreen(e.cx2, e.cy2);
    const p2 = proj.worldToScreen(e.x2, e.y2);

    const isHighlighted =
      focusNode && (focusSet.has(e.fromId) && focusSet.has(e.toId));
    const isDirectTouch =
      focusNode && (e.fromId === focusNode.id || e.toId === focusNode.id);
    const dimFactor = focusNode && !isHighlighted ? 0.35 : 1;

    // Outer soft halo pass
    ctx.strokeStyle = isDirectTouch
      ? palette.branchInner
      : e.kind === 'subbranch'
        ? palette.subBranch
        : palette.branchOuter;
    ctx.globalAlpha = Math.min(
      1,
      (isDirectTouch ? 0.65 : 0.38) * glow * e.intensity * dimFactor
    );
    ctx.lineWidth =
      (isDirectTouch ? 6.2 : e.kind === 'subbranch' ? 2.4 : 4.2) * lwMult;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.bezierCurveTo(pc1.sx, pc1.sy, pc2.sx, pc2.sy, p2.sx, p2.sy);
    ctx.stroke();

    // Inner bright filament pass
    ctx.strokeStyle = isHighlighted ? palette.branchHighlight : palette.branchInner;
    ctx.globalAlpha = Math.min(
      1,
      (isDirectTouch ? 0.98 : isHighlighted ? 0.85 : e.kind === 'subbranch' ? 0.36 : 0.62) *
        glow *
        dimFactor
    );
    ctx.lineWidth =
      (isDirectTouch ? 2.3 : isHighlighted ? 1.6 : e.kind === 'subbranch' ? 0.65 : 1.05) * lwMult;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.bezierCurveTo(pc1.sx, pc1.sy, pc2.sx, pc2.sy, p2.sx, p2.sy);
    ctx.stroke();
  }

  // 3B. Central Spine (Trunk) — 4 layered passes from broad aura to hot white core
  const spinePasses = [
    { color: palette.spineHaloOuter, width: 18, alpha: 0.42 * glow },
    { color: palette.spineHaloMid, width: 7.5, alpha: 0.58 * glow },
    { color: palette.spineFilament, width: 2.6, alpha: 0.85 * glow },
    { color: palette.spineCore, width: 1.15, alpha: 0.95 },
  ];

  for (const pass of spinePasses) {
    ctx.strokeStyle = pass.color;
    ctx.globalAlpha = Math.min(1, pass.alpha);
    ctx.lineWidth = pass.width * lwMult;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < graph.edges.length; i++) {
      const e = graph.edges[i];
      if (e.kind !== 'spine') continue;
      const p1 = proj.worldToScreen(e.x1, e.y1);
      const pc1 = proj.worldToScreen(e.cx1, e.cy1);
      const pc2 = proj.worldToScreen(e.cx2, e.cy2);
      const p2 = proj.worldToScreen(e.x2, e.y2);
      if (!started) {
        ctx.moveTo(p1.sx, p1.sy);
        started = true;
      }
      ctx.bezierCurveTo(pc1.sx, pc1.sy, pc2.sx, pc2.sy, p2.sx, p2.sy);
    }
    ctx.stroke();
  }

  // 3C. Glowing Nodes & Top Terminal Root Bulb
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    if (n.kind === 'dust') continue;

    const p = proj.worldToScreen(n.x, n.y);
    const isRoot = n.kind === 'spine' && n.spineIndex === 0;
    const isSelected = n.id === selectedNodeId;
    const isHovered = n.id === hoveredNodeId;

    if (!isRoot && !n.featured && !isSelected && !isHovered) continue;

    const r = Math.max(2, n.radius * proj.scale) * (isSelected || isHovered ? 1.7 : 1);

    if (isRoot) {
      const bulbGrad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4.5);
      bulbGrad.addColorStop(0, palette.spineCore);
      bulbGrad.addColorStop(0.3, palette.spineFilament);
      bulbGrad.addColorStop(0.7, palette.spineHaloMid);
      bulbGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = bulbGrad;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r * 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = isSelected || isHovered ? 0.95 : 0.7;
      ctx.fillStyle = isSelected || isHovered ? palette.branchHighlight : palette.spineFilament;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Switch back to normal blending for razor-sharp callout guide lines & monospace labels
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (config.showAnnotations) {
    const fontSize = Math.round(11 * exportScale);
    ctx.font = `500 ${fontSize}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < graph.annotations.length; i++) {
      const ann = graph.annotations[i];
      const anchor = proj.worldToScreen(ann.anchorX, ann.anchorY);
      const labelPos = proj.worldToScreen(ann.labelX, ann.labelY);
      const isFocused = focusNode?.id === ann.nodeId;

      if (
        labelPos.sy < -20 ||
        labelPos.sy > height + 20 ||
        labelPos.sx < -160 ||
        labelPos.sx > width + 160
      ) {
        continue;
      }

      // Subtle horizontal / bent leader line
      ctx.strokeStyle = isFocused ? palette.branchHighlight : palette.guideLine;
      ctx.lineWidth = (isFocused ? 1.3 : 0.75) * exportScale;
      ctx.beginPath();
      ctx.moveTo(anchor.sx, anchor.sy);
      if (Math.abs(anchor.sy - labelPos.sy) > 2) {
        const elbowX = anchor.sx + (ann.side === 'left' ? -18 : 18) * exportScale;
        ctx.lineTo(elbowX, labelPos.sy);
      }
      ctx.lineTo(labelPos.sx, labelPos.sy);
      ctx.stroke();

      // Anchor dot
      ctx.fillStyle = isFocused ? palette.branchHighlight : palette.spineFilament;
      ctx.beginPath();
      ctx.arc(anchor.sx, anchor.sy, 2.2 * exportScale, 0, Math.PI * 2);
      ctx.fill();

      // Crisp monospace label
      ctx.textAlign = ann.side === 'left' ? 'right' : 'left';
      ctx.fillStyle = isFocused ? palette.labelHighlight : palette.labelText;
      const textOffset = (ann.side === 'left' ? -7 : 7) * exportScale;
      ctx.fillText(ann.label, labelPos.sx + textOffset, labelPos.sy);
    }
  }

  // Highlight ring around selected or hovered node
  if (focusNode) {
    const fp = proj.worldToScreen(focusNode.x, focusNode.y);
    ctx.strokeStyle = palette.branchHighlight;
    ctx.lineWidth = 1.5 * exportScale;
    ctx.beginPath();
    ctx.arc(fp.sx, fp.sy, 9 * exportScale, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Exports a deterministic 2400x3200 publication-grade PNG poster including title and signature legend.
 */
export function exportPosterPng(
  graph: ArchaeologyGraph,
  config: VisualConfig
): void {
  const posterWidth = 2400;
  const posterHeight = 3200;
  const offscreen = document.createElement('canvas');
  offscreen.width = posterWidth;
  offscreen.height = posterHeight;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return;

  const palette = GRAPH_PALETTES[config.paletteId];

  // Render full graph centered in poster frame
  renderGraphToCanvas(
    ctx,
    graph,
    posterWidth,
    posterHeight,
    { panX: 0, panY: 36, zoom: 1.02 },
    config,
    null,
    null,
    true
  );

  // Top-left editorial poster header
  ctx.save();
  ctx.fillStyle = palette.labelHighlight;
  ctx.font = '600 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${graph.owner}/${graph.repo}`, 96, 86);

  ctx.fillStyle = palette.labelText;
  ctx.font = '400 22px "JetBrains Mono", monospace';
  const modeLabel = graph.mode === 'architecture' ? 'Code Architecture Spine' : 'Git Commit Archaeology';
  ctx.fillText(
    `${modeLabel} · ${graph.stats.spineSteps} spine steps · ${graph.stats.branchCount} branches · ${graph.stats.dustCount} dust`,
    96,
    146
  );

  // Bottom-left signature legend matching @b1rkh0ff format
  const legendX = 96;
  const legendY = posterHeight - 250;
  const rows: Array<{ title: string; desc: string; kind: 'trunk' | 'branches' | 'dust' }> = [
    { title: 'Trunk', desc: graph.spineTitle, kind: 'trunk' },
    { title: 'Branches', desc: graph.branchTitle, kind: 'branches' },
    { title: 'Dust', desc: graph.dustTitle, kind: 'dust' },
  ];

  rows.forEach((row, idx) => {
    const ry = legendY + idx * 54;
    // Icon swatch
    ctx.save();
    if (row.kind === 'trunk') {
      ctx.strokeStyle = palette.spineCore;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(legendX, ry + 14);
      ctx.lineTo(legendX + 44, ry + 14);
      ctx.stroke();
    } else if (row.kind === 'branches') {
      ctx.strokeStyle = palette.branchInner;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(legendX, ry + 18);
      ctx.bezierCurveTo(legendX + 16, ry + 18, legendX + 24, ry + 6, legendX + 44, ry + 6);
      ctx.stroke();
    } else {
      ctx.strokeStyle = palette.dustStroke;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(legendX + 4, ry + 10);
      ctx.lineTo(legendX + 18, ry + 18);
      ctx.moveTo(legendX + 26, ry + 16);
      ctx.lineTo(legendX + 40, ry + 8);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = palette.labelHighlight;
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(row.title, legendX + 64, ry);

    ctx.fillStyle = palette.labelText;
    ctx.font = '400 20px "JetBrains Mono", monospace';
    ctx.fillText(row.desc, legendX + 195, ry + 2);
  });

  ctx.restore();

  const dataUrl = offscreen.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `arbortrace-${graph.owner}-${graph.repo}-${graph.mode}.png`.toLowerCase();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
