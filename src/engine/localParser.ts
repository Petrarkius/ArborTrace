import { RawBranchItem, RawDustItem, RawRepoDataset, RawSpineItem } from '../types/graph';

const CODE_EXTS = new Set([
  'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'hh', 'cu', 'cuh', 'm', 'mm',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'py', 'rs', 'go', 'java', 'kt', 'swift',
]);

function getExt(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function extractImports(content: string): string[] {
  const refs: string[] = [];
  const includeRe = /#include\s+["<]([^">]+)[">]/g;
  const esImportRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const pyImportRe = /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g;

  let m: RegExpExecArray | null;
  while ((m = includeRe.exec(content)) !== null) refs.push(m[1]);
  while ((m = esImportRe.exec(content)) !== null) refs.push(m[1]);
  while ((m = requireRe.exec(content)) !== null) refs.push(m[1]);
  while ((m = pyImportRe.exec(content)) !== null) refs.push((m[1] || m[2]).replace(/\./g, '/'));
  return refs;
}

/** Parse a browser-uploaded directory (webkitdirectory FileList) into a RawRepoDataset */
export async function parseLocalFolder(fileList: FileList): Promise<RawRepoDataset> {
  const allFiles = Array.from(fileList).filter((f) => {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    return !rel.includes('node_modules/') && !rel.includes('/.git/') && !rel.includes('/dist/') && !rel.includes('/build/');
  });

  if (allFiles.length === 0) {
    throw new Error('No readable files found in the selected folder.');
  }

  const firstRel = (allFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath || allFiles[0].name;
  const rootFolder = firstRel.includes('/') ? firstRel.split('/')[0] : 'local-repo';

  const codeFiles = allFiles
    .map((file) => {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const cleanPath = rel.startsWith(`${rootFolder}/`) ? rel.slice(rootFolder.length + 1) : rel;
      return { file, path: cleanPath, ext: getExt(cleanPath) };
    })
    .filter((f) => CODE_EXTS.has(f.ext))
    .slice(0, 600);

  if (codeFiles.length === 0) {
    throw new Error('No supported source code files (.c, .cpp, .ts, .js, .py, .rs, .go, etc.) found.');
  }

  // Build lookup by filename and normalized path
  const pathSet = new Set(codeFiles.map((f) => f.path));
  const byBase = new Map<string, string[]>();
  for (const cf of codeFiles) {
    const b = basename(cf.path);
    const arr = byBase.get(b) ?? [];
    arr.push(cf.path);
    byBase.set(b, arr);
  }

  // Parse up to 160 reasonably-sized source files to build real dependency graph
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  for (const cf of codeFiles) {
    inDegree.set(cf.path, 0);
    outEdges.set(cf.path, []);
  }

  const sampleForParsing = codeFiles.slice(0, 160);
  await Promise.all(
    sampleForParsing.map(async (cf) => {
      if (cf.file.size > 400_000) return;
      try {
        const text = await cf.file.text();
        const rawRefs = extractImports(text);
        const resolved: string[] = [];
        for (const r of rawRefs) {
          const clean = r.replace(/^\.\//, '').replace(/^\.\.\//, '');
          if (pathSet.has(clean)) {
            resolved.push(clean);
          } else {
            const b = basename(clean);
            const candidates = byBase.get(b) ?? byBase.get(`${b}.${cf.ext}`);
            if (candidates && candidates.length > 0 && candidates[0] !== cf.path) {
              resolved.push(candidates[0]);
            }
          }
        }
        const unique = Array.from(new Set(resolved));
        outEdges.set(cf.path, unique);
        for (const target of unique) {
          inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
        }
      } catch {
        // Ignore unreadable file
      }
    })
  );

  // Rank nodes by structural centrality (inDegree + outEdges) to form the Spine
  const scored = codeFiles.map((cf) => {
    const isEntry = /^(main|index|app|server|lib|mod|llama|core)\./i.test(basename(cf.path));
    const isTestOrExample = /(^|\/)(test|tests|example|examples|bench|scripts|docs)\//i.test(cf.path);
    const score =
      (inDegree.get(cf.path) ?? 0) * 3 +
      (outEdges.get(cf.path)?.length ?? 0) * 2 +
      (isEntry ? 12 : 0) -
      (isTestOrExample ? 10 : 0);
    return { ...cf, score, isTestOrExample };
  });

  scored.sort((a, b) => b.score - a.score);

  const spineLimit = Math.min(Math.max(12, Math.floor(scored.length * 0.28)), 90);
  const spineFiles = scored.slice(0, spineLimit);
  const spineIdByPath = new Map<string, string>();

  const archSpine: RawSpineItem[] = spineFiles.map((cf, i) => {
    const id = `loc-s-${i}`;
    spineIdByPath.set(cf.path, id);
    const deps = outEdges.get(cf.path)?.length ?? 0;
    const refs = inDegree.get(cf.path) ?? 0;
    return {
      id,
      label: basename(cf.path),
      subtitle: cf.path,
      category: cf.path.includes('/') ? cf.path.split('/')[0] : 'root',
      ref: cf.path,
      description: `${cf.path} · ${refs} incoming dependents · ${deps} outgoing imports`,
      featured: i === 0 || i % Math.max(3, Math.floor(spineFiles.length / 10)) === 0,
      labelSide: i % 2 === 0 ? 'left' : 'right',
    };
  });

  const remaining = scored.slice(spineLimit);
  const archBranches: RawBranchItem[] = [];
  const archDust: RawDustItem[] = [];

  remaining.forEach((cf, idx) => {
    const targets = outEdges.get(cf.path) ?? [];
    const connectedSpine = targets.find((t) => spineIdByPath.has(t));
    const dirPrefix = cf.path.includes('/') ? cf.path.split('/')[0] : 'module';

    if ((connectedSpine || (!cf.isTestOrExample && (inDegree.get(cf.path) ?? 0) > 0)) && archBranches.length < 220) {
      const fromId = connectedSpine
        ? spineIdByPath.get(connectedSpine)!
        : archSpine[idx % archSpine.length].id;
      const side: 'left' | 'right' = dirPrefix.charCodeAt(0) % 2 === 0 ? 'left' : 'right';
      archBranches.push({
        id: `loc-b-${idx}`,
        label: basename(cf.path),
        category: dirPrefix,
        ref: cf.path,
        fromSpineId: fromId,
        side,
        depth: 0.35 + (idx % 7) * 0.08,
        description: `${cf.path} (${targets.length} parsed imports)`,
        featured: idx < 12,
      });
    } else {
      archDust.push({
        id: `loc-d-${idx}`,
        label: cf.path,
        category: cf.isTestOrExample ? 'Test / Example' : 'Unreached File',
        ref: cf.path,
        description: `Disconnected from core dependency spine (${cf.path}).`,
      });
    }
  });

  // Also synthesize a file-recency timeline for History mode using File.lastModified
  const byTime = [...codeFiles].sort((a, b) => b.file.lastModified - a.file.lastModified);
  const histSpineCount = Math.min(80, Math.max(10, Math.floor(byTime.length * 0.3)));
  const histSpine: RawSpineItem[] = byTime.slice(0, histSpineCount).map((cf, i) => ({
    id: `loch-s-${i}`,
    label: basename(cf.path),
    category: 'Modified Timeline',
    ref: cf.path,
    timestamp: new Date(cf.file.lastModified).toISOString().slice(0, 10),
    description: `Last modified ${new Date(cf.file.lastModified).toLocaleDateString()} (${cf.path}).`,
    featured: i === 0 || i % Math.max(4, Math.floor(histSpineCount / 8)) === 0,
    labelSide: i % 2 === 0 ? 'left' : 'right',
  }));

  const histBranches: RawBranchItem[] = byTime.slice(histSpineCount, histSpineCount + 140).map((cf, i) => ({
    id: `loch-b-${i}`,
    label: basename(cf.path),
    category: cf.path.includes('/') ? cf.path.split('/')[0] : 'module',
    ref: cf.path,
    fromSpineId: histSpine[i % histSpine.length].id,
    side: i % 2 === 0 ? 'left' : 'right',
    depth: 0.4 + (i % 5) * 0.1,
    timestamp: new Date(cf.file.lastModified).toISOString().slice(0, 10),
    description: `Co-modified file in ${cf.path}`,
    featured: i < 8,
  }));

  const histDust: RawDustItem[] = byTime.slice(histSpineCount + 140).map((cf, i) => ({
    id: `loch-d-${i}`,
    label: cf.path,
    category: 'Older / Auxiliary',
    ref: cf.path,
    description: `Auxiliary local file (${cf.path}).`,
  }));

  return {
    owner: 'local',
    repo: rootFolder,
    description: `Local codebase upload (${codeFiles.length} source files analyzed in browser).`,
    defaultBranch: 'local',
    sourceKind: 'local-folder',
    fetchedAt: new Date().toISOString(),
    architecture: {
      spineTitle: `${archSpine.length}-file core dependency spine`,
      branchTitle: 'Sample of parsed module imports & subsystems',
      dustTitle: 'Tests, examples & unreferenced files',
      totalFiles: codeFiles.length,
      spine: archSpine,
      branches: archBranches,
      dust: archDust,
    },
    history: {
      spineTitle: `${histSpine.length}-file modification chronology`,
      branchTitle: 'Co-modified directory clusters (upload git log for commit DAG)',
      dustTitle: 'Older or auxiliary workspace files',
      totalCommits: codeFiles.length,
      spine: histSpine,
      branches: histBranches,
      dust: histDust,
    },
  };
}

/**
 * Parse a `git log --format="%H|%P|%at|%an|%s" -n 500` text dump or JSON graph export
 */
export async function parseUploadedFile(file: File): Promise<RawRepoDataset> {
  const text = await file.text();

  // Check if JSON RawRepoDataset
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text);
    if (parsed && parsed.architecture && parsed.history && parsed.repo) {
      return {
        ...parsed,
        sourceKind: 'local-json',
      } as RawRepoDataset;
    }
    throw new Error('JSON file does not match ArborTrace RawRepoDataset schema.');
  }

  // Parse pipe-delimited git log export: hash|parents|unix_ts|author|subject
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  interface CommitRow {
    hash: string;
    parents: string[];
    timestamp: string;
    author: string;
    subject: string;
  }

  const commits: CommitRow[] = [];
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length >= 5) {
      const [hash, parentStr, tsRaw, author, ...rest] = parts;
      const tsNum = Number(tsRaw);
      const iso = Number.isFinite(tsNum) && tsNum > 0
        ? new Date(tsNum * 1000).toISOString().slice(0, 10)
        : tsRaw;
      commits.push({
        hash: hash.trim(),
        parents: parentStr.trim() ? parentStr.trim().split(/\s+/) : [],
        timestamp: iso,
        author: author.trim(),
        subject: rest.join('|').trim(),
      });
    }
  }

  if (commits.length < 2) {
    throw new Error(
      'Could not parse git log. Export with: git log --format="%H|%P|%at|%an|%s" -n 400 > gitlog.txt'
    );
  }

  const byHash = new Map(commits.map((c) => [c.hash, c]));
  const spineSet = new Set<string>();
  const spineCommits: CommitRow[] = [];

  // Walk first-parent chain from newest commit
  let curr: CommitRow | undefined = commits[0];
  while (curr && spineCommits.length < 160 && !spineSet.has(curr.hash)) {
    spineSet.add(curr.hash);
    spineCommits.push(curr);
    const firstParent: string | undefined = curr.parents[0];
    curr = firstParent ? byHash.get(firstParent) : undefined;
  }

  const spineIdByHash = new Map<string, string>();
  const histSpine: RawSpineItem[] = spineCommits.map((c, i) => {
    const id = `gl-s-${i}`;
    spineIdByHash.set(c.hash, id);
    return {
      id,
      label: c.subject.slice(0, 44),
      category: 'First-Parent Spine',
      ref: c.hash.slice(0, 7),
      author: c.author,
      timestamp: c.timestamp,
      description: `${c.subject} (${c.hash.slice(0, 10)})`,
      featured: i === 0 || c.parents.length > 1 || i % Math.max(4, Math.floor(spineCommits.length / 10)) === 0,
      labelSide: i % 2 === 0 ? 'left' : 'right',
    };
  });

  const histBranches: RawBranchItem[] = [];
  const histDust: RawDustItem[] = [];

  commits.forEach((c, idx) => {
    if (spineSet.has(c.hash)) return;
    // Find if any spine commit or earlier commit links to it
    const anchorIdx = Math.min(histSpine.length - 1, Math.floor((idx / commits.length) * histSpine.length));
    const anchor = histSpine[anchorIdx];
    if (c.parents.length > 0 && histBranches.length < 220) {
      histBranches.push({
        id: `gl-b-${idx}`,
        label: c.subject.slice(0, 38),
        category: 'Branch Commit',
        ref: c.hash.slice(0, 7),
        fromSpineId: anchor.id,
        toSpineId: histSpine[Math.max(0, anchorIdx - 2)].id,
        side: idx % 2 === 0 ? 'left' : 'right',
        depth: 0.35 + (idx % 6) * 0.09,
        author: c.author,
        timestamp: c.timestamp,
        description: c.subject,
        featured: idx % 18 === 0,
      });
    } else {
      histDust.push({
        id: `gl-d-${idx}`,
        label: `${c.hash.slice(0, 7)} · ${c.subject.slice(0, 28)}`,
        category: 'Orphan / Detached Commit',
        ref: c.hash.slice(0, 7),
        description: `${c.subject} by ${c.author}`,
      });
    }
  });

  const repoName = file.name.replace(/\.[^.]+$/, '');
  return {
    owner: 'git-export',
    repo: repoName,
    description: `Parsed git commit DAG (${commits.length} commits from ${file.name}).`,
    defaultBranch: 'HEAD',
    sourceKind: 'local-gitlog',
    fetchedAt: new Date().toISOString(),
    history: {
      spineTitle: `${histSpine.length}-commit first-parent spine`,
      branchTitle: 'Merged side-branch commits & PR arcs',
      dustTitle: 'Detached or unreached commits',
      totalCommits: commits.length,
      spine: histSpine,
      branches: histBranches,
      dust: histDust,
    },
    // Also map into architecture view if toggled
    architecture: {
      spineTitle: `${histSpine.length}-commit topological spine`,
      branchTitle: 'Side-branch commit clusters',
      dustTitle: 'Detached commits',
      totalFiles: commits.length,
      spine: histSpine,
      branches: histBranches,
      dust: histDust,
    },
  };
}
