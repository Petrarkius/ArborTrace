import {
  ArchaeologyGraph,
  ArchaeologyMode,
  GraphAnnotation,
  LayoutDustStroke,
  LayoutEdge,
  LayoutNode,
  RawRepoDataset,
  VisualConfig,
} from '../types/graph';

/** Deterministic seeded PRNG (Mulberry32) so layout jitter stays stable across renders */
function createRng(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildArchaeologyGraph(
  dataset: RawRepoDataset,
  mode: ArchaeologyMode,
  config: VisualConfig
): ArchaeologyGraph {
  const slice = mode === 'architecture' ? dataset.architecture : dataset.history;
  const rng = createRng(`${dataset.owner}/${dataset.repo}:${mode}`);

  const nodes: LayoutNode[] = [];
  const nodeMap: Record<string, LayoutNode> = {};
  const edges: LayoutEdge[] = [];
  const dustStrokes: LayoutDustStroke[] = [];

  const spineItems = slice.spine.length > 0 ? slice.spine : [];
  const spineCount = spineItems.length;
  const spineIdxById = new Map<string, number>();
  for (let i = 0; i < spineCount; i++) {
    spineIdxById.set(spineItems[i].id, i);
  }

  const branchItems = slice.branches;
  const primaryBranches = branchItems.filter((b) => !b.parentBranchId);
  const secondaryBranches = branchItems.filter((b) => Boolean(b.parentBranchId));

  // Count secondary sub-branches attached to each primary branch for pull weighting
  const subCountByParent = new Map<string, number>();
  for (let i = 0; i < secondaryBranches.length; i++) {
    const pid = secondaryBranches[i].parentBranchId;
    if (pid) {
      subCountByParent.set(pid, (subCountByParent.get(pid) ?? 0) + 1);
    }
  }

  // Pre-resolve primary branch direction/depth and accumulate horizontal pull forces along spine
  const rawPull = new Float64Array(spineCount);
  const fallbackIdx = Math.floor(spineCount * 0.5);
  const primarySpecs = primaryBranches.map((b) => {
    const dir = b.side === 'left' ? -1 : b.side === 'right' ? 1 : rng() > 0.5 ? 1 : -1;
    const baseDepth = b.depth ?? 0.35 + rng() * 0.45;
    const fromIdx = spineIdxById.get(b.fromSpineId) ?? fallbackIdx;
    const toIdx = b.toSpineId ? spineIdxById.get(b.toSpineId) : undefined;
    const subCount = subCountByParent.get(b.id) ?? 0;
    const pullWeight = (b.featured ? 1.45 : 1.0) * (0.45 + 0.55 * baseDepth) + subCount * 0.35;

    if (spineCount > 0) {
      rawPull[fromIdx] += dir * pullWeight;
      if (typeof toIdx === 'number' && toIdx !== fromIdx) {
        rawPull[toIdx] += dir * pullWeight * 0.45;
      }
    }

    return { b, dir, baseDepth, fromIdx };
  });

  // Smooth pull forces across neighboring spine steps so branches induce cohesive structural bends
  const smoothedPull = new Float64Array(spineCount);
  const kernelWeights = [0.06, 0.12, 0.2, 0.24, 0.2, 0.12, 0.06];
  for (let i = 0; i < spineCount; i++) {
    let acc = 0;
    let wSum = 0;
    for (let k = -3; k <= 3; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < spineCount) {
        const w = kernelWeights[k + 3];
        acc += rawPull[idx] * w;
        wSum += w;
      }
    }
    smoothedPull[i] = wSum > 0 ? acc / wSum : 0;
  }

  // 1. Anchor Spine along central axis X ≈ 0, deflected by net left/right branch pull
  let driftX = 0;
  const pullScale = 0.022 * config.spineJitter;
  const maxDeflection = 0.16 * Math.max(0.25, config.spineJitter);

  for (let i = 0; i < spineCount; i++) {
    const item = spineItems[i];
    const t = spineCount > 1 ? i / (spineCount - 1) : 0;
    const y = 0.07 + t * 0.86;

    // Damped spring pull toward net branch weight + soft restoring tension toward X = 0
    driftX = driftX * 0.72 + smoothedPull[i] * pullScale;
    const clampedX = Math.max(-maxDeflection, Math.min(maxDeflection, driftX));
    const x = i === 0 || config.spineJitter === 0 ? 0 : clampedX;

    const node: LayoutNode = {
      id: item.id,
      kind: 'spine',
      label: item.label,
      subtitle: item.subtitle,
      category: item.category,
      ref: item.ref,
      author: item.author,
      timestamp: item.timestamp,
      description: item.description,
      url: item.url,
      x,
      y,
      radius: i === 0 ? 0.016 : item.featured ? 0.008 : 0.0045,
      spineIndex: i,
      connectedIds: [],
      featured: Boolean(item.featured || i === 0),
    };
    nodes.push(node);
    nodeMap[node.id] = node;
  }

  // Spine segments connecting consecutive spine nodes smoothly along branch-induced curvature
  for (let i = 0; i < spineCount - 1; i++) {
    const a = nodeMap[spineItems[i].id];
    const b = nodeMap[spineItems[i + 1].id];
    a.connectedIds.push(b.id);
    b.connectedIds.push(a.id);

    const midY = (a.y + b.y) * 0.5;
    const dx = b.x - a.x;
    edges.push({
      id: `se-${a.id}-${b.id}`,
      kind: 'spine',
      fromId: a.id,
      toId: b.id,
      x1: a.x,
      y1: a.y,
      cx1: a.x + dx * 0.25,
      cy1: midY,
      cx2: b.x - dx * 0.25,
      cy2: midY,
      x2: b.x,
      y2: b.y,
      intensity: 1,
    });
  }

  // 2. Layout primary and secondary Branches outward from the Spine
  const spread = config.branchSpread;

  for (let i = 0; i < primarySpecs.length; i++) {
    const { b, dir, baseDepth, fromIdx } = primarySpecs[i];
    const fromSpine = nodeMap[b.fromSpineId] ?? nodes[fromIdx];
    if (!fromSpine) continue;

    const toSpine = b.toSpineId ? nodeMap[b.toSpineId] : undefined;
    const radialReach = (0.14 + baseDepth * 0.48) * spread;
    const verticalLift = (0.025 + rng() * 0.09) * (toSpine ? 0.6 : 1);

    const x = fromSpine.x + dir * radialReach;
    const y = Math.max(0.05, Math.min(0.95, fromSpine.y - verticalLift * 0.4 + (rng() - 0.5) * 0.05));

    const node: LayoutNode = {
      id: b.id,
      kind: 'branch',
      label: b.label,
      category: b.category,
      ref: b.ref,
      author: b.author,
      timestamp: b.timestamp,
      description: b.description,
      url: b.url,
      x,
      y,
      radius: b.featured ? 0.0068 : 0.0042,
      connectedIds: [fromSpine.id],
      featured: Boolean(b.featured),
    };

    fromSpine.connectedIds.push(node.id);
    nodes.push(node);
    nodeMap[node.id] = node;

    // Outbound cubic Bézier filament from spine to branch tip
    edges.push({
      id: `be-out-${b.id}`,
      kind: 'branch',
      fromId: fromSpine.id,
      toId: node.id,
      x1: fromSpine.x,
      y1: fromSpine.y,
      cx1: fromSpine.x + dir * radialReach * 0.25,
      cy1: fromSpine.y - 0.015,
      cx2: x - dir * radialReach * 0.18,
      cy2: y + 0.025,
      x2: x,
      y2: y,
      intensity: b.featured ? 0.95 : 0.65,
    });

    // Optional convergence arc back up into the spine (DAG / merged PR feel)
    if (toSpine && toSpine.id !== fromSpine.id) {
      node.connectedIds.push(toSpine.id);
      toSpine.connectedIds.push(node.id);
      edges.push({
        id: `be-in-${b.id}`,
        kind: 'branch',
        fromId: node.id,
        toId: toSpine.id,
        x1: x,
        y1: y,
        cx1: x - dir * radialReach * 0.12,
        cy1: (y + toSpine.y) * 0.5 - 0.02,
        cx2: toSpine.x + dir * radialReach * 0.3,
        cy2: toSpine.y + 0.02,
        x2: toSpine.x,
        y2: toSpine.y,
        intensity: b.featured ? 0.8 : 0.5,
      });
    }
  }

  // Second pass: secondary dendritic sub-filaments sprouting off primary branches
  for (let i = 0; i < secondaryBranches.length; i++) {
    const sb = secondaryBranches[i];
    const parent = (sb.parentBranchId && nodeMap[sb.parentBranchId]) || nodeMap[sb.fromSpineId];
    if (!parent) continue;

    const dir = parent.x < 0 ? -1 : 1;
    const subSpanX = (0.06 + rng() * 0.18) * spread;
    const subSpanY = (rng() - 0.55) * 0.11;
    const x = Math.max(-0.92, Math.min(0.92, parent.x + dir * subSpanX));
    const y = Math.max(0.05, Math.min(0.95, parent.y + subSpanY));

    const node: LayoutNode = {
      id: sb.id,
      kind: 'branch',
      label: sb.label,
      category: sb.category,
      ref: sb.ref,
      author: sb.author,
      timestamp: sb.timestamp,
      description: sb.description,
      url: sb.url,
      x,
      y,
      radius: 0.0032,
      connectedIds: [parent.id],
      featured: Boolean(sb.featured),
    };
    parent.connectedIds.push(node.id);
    nodes.push(node);
    nodeMap[node.id] = node;

    edges.push({
      id: `sbe-${sb.id}`,
      kind: 'subbranch',
      fromId: parent.id,
      toId: node.id,
      x1: parent.x,
      y1: parent.y,
      cx1: parent.x + dir * subSpanX * 0.45,
      cy1: parent.y + subSpanY * 0.15,
      cx2: x - dir * subSpanX * 0.2,
      cy2: y - subSpanY * 0.15,
      x2: x,
      y2: y,
      intensity: 0.45,
    });
  }

  // 3. Layout peripheral "Dust" (unreachable files / pruned branches)
  const dustCountTarget = Math.round(slice.dust.length * config.dustDensity);
  for (let i = 0; i < dustCountTarget; i++) {
    const d = slice.dust[i];
    // Cluster subtly in outer flanking zones avoiding direct center spine corridor
    const side = rng() > 0.5 ? 1 : -1;
    const x = side * (0.24 + Math.pow(rng(), 0.78) * 0.68);
    const y = 0.06 + rng() * 0.88;

    const node: LayoutNode = {
      id: d.id,
      kind: 'dust',
      label: d.label,
      category: d.category,
      ref: d.ref,
      description: d.description,
      url: d.url,
      x,
      y,
      radius: 0.0025,
      connectedIds: [],
      featured: false,
    };
    nodes.push(node);
    nodeMap[node.id] = node;

    const len = 0.012 + rng() * 0.032;
    const angle = rng() * Math.PI * 2;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    dustStrokes.push({
      id: `ds-${d.id}`,
      nodeId: d.id,
      x1: x,
      y1: y,
      cx: (x + x2) * 0.5 + (rng() - 0.5) * 0.012,
      cy: (y + y2) * 0.5 + (rng() - 0.5) * 0.012,
      x2,
      y2,
      alpha: 0.25 + rng() * 0.45,
    });
  }

  // 4. Generate collision-resolved horizontal callout annotations
  const annotations: GraphAnnotation[] = [];
  if (config.showAnnotations) {
    const featuredNodes = nodes.filter((n) => n.featured && n.kind !== 'dust');
    const maxLabels = Math.max(4, Math.round(featuredNodes.length * config.labelDensity));
    const selectedForLabels = featuredNodes
      .sort((a, b) => {
        if (a.kind === 'spine' && b.kind !== 'spine') return -1;
        if (a.kind !== 'spine' && b.kind === 'spine') return 1;
        return a.y - b.y;
      })
      .slice(0, maxLabels);

    const placedLeftY: number[] = [];
    const placedRightY: number[] = [];
    const minVerticalGap = 0.036;

    selectedForLabels.forEach((n, idx) => {
      // Determine preferred side
      const rawItem =
        n.kind === 'spine'
          ? slice.spine.find((s) => s.id === n.id)
          : undefined;
      let side: 'left' | 'right' =
        rawItem?.labelSide ?? (n.x < -0.02 ? 'left' : n.x > 0.02 ? 'right' : idx % 2 === 0 ? 'left' : 'right');

      const bucket = side === 'left' ? placedLeftY : placedRightY;
      // Nudge vertically if too close to an already placed label on the same side
      let labelY = n.y;
      for (let attempt = 0; attempt < 6; attempt++) {
        const collision = bucket.some((py) => Math.abs(py - labelY) < minVerticalGap);
        if (!collision) break;
        labelY += (attempt % 2 === 0 ? 1 : -1) * minVerticalGap * (Math.floor(attempt / 2) + 1);
      }
      if (bucket.some((py) => Math.abs(py - labelY) < minVerticalGap * 0.78)) {
        // Try opposite side for spine nodes before dropping
        if (n.kind === 'spine') {
          side = side === 'left' ? 'right' : 'left';
          const altBucket = side === 'left' ? placedLeftY : placedRightY;
          if (altBucket.some((py) => Math.abs(py - n.y) < minVerticalGap * 0.78)) {
            return;
          }
          labelY = n.y;
          altBucket.push(labelY);
        } else {
          return;
        }
      } else {
        bucket.push(labelY);
      }

      const labelX = side === 'left' ? Math.min(-0.62, n.x - 0.16) : Math.max(0.62, n.x + 0.16);
      annotations.push({
        nodeId: n.id,
        label: n.label,
        anchorX: n.x,
        anchorY: n.y,
        labelX: Math.max(-0.9, Math.min(0.9, labelX)),
        labelY: Math.max(0.04, Math.min(0.96, labelY)),
        side,
      });
    });
  }

  return {
    owner: dataset.owner,
    repo: dataset.repo,
    description: dataset.description,
    mode,
    sourceKind: dataset.sourceKind,
    spineTitle: slice.spineTitle,
    branchTitle: slice.branchTitle,
    dustTitle: slice.dustTitle,
    stats: {
      spineSteps: spineItems.length,
      branchCount: branchItems.length,
      dustCount: dustCountTarget,
      totalFilesOrCommits:
        mode === 'architecture' ? dataset.architecture.totalFiles : dataset.history.totalCommits,
    },
    nodes,
    nodeMap,
    edges,
    dustStrokes,
    annotations,
  };
}
