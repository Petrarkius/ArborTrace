import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const OWNER_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
const REPO_RE = /^[a-zA-Z0-9._-]{1,100}$/;
const CODE_EXTS = new Set([
  'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'hh', 'cu', 'cuh', 'm', 'mm',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'py', 'rs', 'go', 'java', 'kt', 'swift',
]);

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'ArborTrace-Code-Archaeology/1.0',
    Accept: 'application/vnd.github+json',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token && token !== 'MY_GITHUB_TOKEN') {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchGitHubJson<T>(url: string): Promise<{ ok: boolean; status: number; data?: T; message?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: getGitHubHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) {
      let msg = `GitHub API returned ${res.status}`;
      try {
        const errBody = (await res.json()) as { message?: string };
        if (errBody?.message) msg = errBody.message;
      } catch {
        // ignore parse error
      }
      return { ok: false, status: res.status, message: msg };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: err instanceof Error ? err.message : 'Network error reaching GitHub API',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRawFile(owner: string, repo: string, branch: string, filePath: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ArborTrace-Code-Archaeology/1.0' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 120_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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

function getExt(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  return idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : '';
}

function basename(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx >= 0 ? filePath.slice(idx + 1) : filePath;
}

interface GitHubRepoInfo {
  name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
}

interface GitHubCommitItem {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author?: { login?: string } | null;
  parents: Array<{ sha: string }>;
}

interface GitHubBranchItem {
  name: string;
  commit: { sha: string };
}

interface GitHubTreeResp {
  tree: Array<{ path: string; type: 'blob' | 'tree'; size?: number }>;
  truncated: boolean;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/github/analyze', async (req, res) => {
    const owner = String(req.query.owner ?? '').trim();
    const repo = String(req.query.repo ?? '').trim();

    if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) {
      res.status(400).json({
        error: 'Invalid repository slug. Use a valid GitHub owner and repository name (e.g. ggml-org/llama.cpp).',
      });
      return;
    }

    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repo);

    // 1. Repository metadata
    const repoResp = await fetchGitHubJson<GitHubRepoInfo>(
      `https://api.github.com/repos/${safeOwner}/${safeRepo}`
    );
    if (!repoResp.ok || !repoResp.data) {
      res.status(repoResp.status === 404 ? 404 : repoResp.status === 403 ? 429 : 502).json({
        error:
          repoResp.status === 403
            ? 'GitHub API rate limit reached. Try uploading a local folder or git log dump, or configure GITHUB_TOKEN in Secrets.'
            : repoResp.message || 'Unable to load GitHub repository.',
      });
      return;
    }

    const repoInfo = repoResp.data;
    const defaultBranch = repoInfo.default_branch || 'main';
    const htmlBase = `https://github.com/${owner}/${repo}`;

    // 2. Fetch commits, branches, and git tree in parallel
    const [commitsResp, branchesResp, treeResp] = await Promise.all([
      fetchGitHubJson<GitHubCommitItem[]>(
        `https://api.github.com/repos/${safeOwner}/${safeRepo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=100`
      ),
      fetchGitHubJson<GitHubBranchItem[]>(
        `https://api.github.com/repos/${safeOwner}/${safeRepo}/branches?per_page=60`
      ),
      fetchGitHubJson<GitHubTreeResp>(
        `https://api.github.com/repos/${safeOwner}/${safeRepo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`
      ),
    ]);

    // Build History Dataset
    const commits = commitsResp.ok && Array.isArray(commitsResp.data) ? commitsResp.data : [];
    const branches = branchesResp.ok && Array.isArray(branchesResp.data) ? branchesResp.data : [];

    const commitBySha = new Map(commits.map((c) => [c.sha, c]));
    const firstParentSet = new Set<string>();
    const firstParentList: GitHubCommitItem[] = [];

    let cursor: GitHubCommitItem | undefined = commits[0];
    while (cursor && firstParentList.length < 100 && !firstParentSet.has(cursor.sha)) {
      firstParentSet.add(cursor.sha);
      firstParentList.push(cursor);
      const pSha: string | undefined = cursor.parents[0]?.sha;
      cursor = pSha ? commitBySha.get(pSha) : undefined;
    }

    // Fallback if commits are shallowly linked
    if (firstParentList.length < Math.min(20, commits.length)) {
      for (const c of commits) {
        if (!firstParentSet.has(c.sha)) {
          firstParentSet.add(c.sha);
          firstParentList.push(c);
        }
      }
    }

    const histSpine = firstParentList.map((c, i) => {
      const subject = c.commit.message.split('\n')[0].slice(0, 48);
      return {
        id: `gh-hs-${i}`,
        label: subject,
        ref: c.sha.slice(0, 7),
        category: c.parents.length > 1 ? 'Merge Milestone' : 'First-Parent Commit',
        author: c.author?.login || c.commit.author?.name || 'contributor',
        timestamp: (c.commit.author?.date || '').slice(0, 10),
        description: c.commit.message.slice(0, 260),
        url: c.html_url,
        featured:
          i === 0 ||
          c.parents.length > 1 ||
          i % Math.max(4, Math.floor(firstParentList.length / 10)) === 0,
        labelSide: (i % 2 === 0 ? 'left' : 'right') as 'left' | 'right',
      };
    });

    const histBranches: Array<{
      id: string;
      label: string;
      category: string;
      ref: string;
      fromSpineId: string;
      toSpineId?: string;
      side: 'left' | 'right';
      depth: number;
      author?: string;
      timestamp?: string;
      description?: string;
      url?: string;
      featured?: boolean;
    }> = [];

    const nonSpineCommits = commits.filter((c) => !firstParentSet.has(c.sha));
    nonSpineCommits.forEach((c, idx) => {
      if (histSpine.length === 0) return;
      const anchorIdx = Math.min(
        histSpine.length - 1,
        Math.floor((idx / Math.max(1, nonSpineCommits.length)) * histSpine.length)
      );
      const subject = c.commit.message.split('\n')[0].slice(0, 40);
      histBranches.push({
        id: `gh-hb-${idx}`,
        label: subject,
        category: 'Branch Commit',
        ref: c.sha.slice(0, 7),
        fromSpineId: histSpine[anchorIdx].id,
        toSpineId: histSpine[Math.max(0, anchorIdx - 2)].id,
        side: idx % 2 === 0 ? 'left' : 'right',
        depth: 0.36 + (idx % 6) * 0.08,
        author: c.author?.login || c.commit.author?.name,
        timestamp: (c.commit.author?.date || '').slice(0, 10),
        description: c.commit.message.slice(0, 240),
        url: c.html_url,
        featured: idx % 8 === 0,
      });
    });

    const histDust = branches
      .filter((b) => b.name !== defaultBranch)
      .map((b, idx) => ({
        id: `gh-hd-${idx}`,
        label: `branch/${b.name}`,
        category: 'Parallel / Unmerged Branch',
        ref: b.commit.sha.slice(0, 7),
        description: `Remote branch ${b.name} (${b.commit.sha.slice(0, 10)}) outside ${defaultBranch} spine.`,
        url: `${htmlBase}/tree/${encodeURIComponent(b.name)}`,
      }));

    // Build Architecture Dataset from Git Tree + selective raw source import parsing
    const blobs = (treeResp.ok && treeResp.data?.tree ? treeResp.data.tree : []).filter(
      (item) => item.type === 'blob'
    );
    const codeBlobs = blobs.filter((b) => CODE_EXTS.has(getExt(b.path)));
    const targetBlobs = (codeBlobs.length > 0 ? codeBlobs : blobs).slice(0, 650);

    const pathSet = new Set(targetBlobs.map((b) => b.path));
    const byBase = new Map<string, string[]>();
    for (const b of targetBlobs) {
      const name = basename(b.path);
      const arr = byBase.get(name) ?? [];
      arr.push(b.path);
      byBase.set(name, arr);
    }

    // Prioritize core source files (src/, lib/, include/, core/, index/main) for raw import parsing
    const priorityScore = (p: string): number => {
      let s = 0;
      if (/(^|\/)(src|core|lib|include|ggml|packages)\//i.test(p)) s += 20;
      if (/^(src\/)?(main|index|app|server|llama|ggml|lib|mod|core)\./i.test(p)) s += 25;
      if (/(^|\/)(test|tests|example|examples|docs|bench|scripts)\//i.test(p)) s -= 25;
      s -= p.split('/').length * 2;
      return s;
    };

    const sortedBlobs = [...targetBlobs].sort((a, b) => priorityScore(b.path) - priorityScore(a.path));
    const parseCandidates = sortedBlobs.slice(0, 18);

    const inDegree = new Map<string, number>();
    const outEdges = new Map<string, string[]>();
    for (const b of targetBlobs) {
      inDegree.set(b.path, 0);
      outEdges.set(b.path, []);
    }

    await Promise.all(
      parseCandidates.map(async (b) => {
        const content = await fetchRawFile(owner, repo, defaultBranch, b.path);
        if (!content) return;
        const refs = extractImports(content);
        const resolved: string[] = [];
        for (const r of refs) {
          const clean = r.replace(/^\.\//, '').replace(/^\.\.\//, '');
          if (pathSet.has(clean)) {
            resolved.push(clean);
          } else {
            const name = basename(clean);
            const candidates = byBase.get(name) ?? byBase.get(`${name}.${getExt(b.path)}`);
            if (candidates && candidates.length > 0 && candidates[0] !== b.path) {
              resolved.push(candidates[0]);
            }
          }
        }
        const unique = Array.from(new Set(resolved));
        outEdges.set(b.path, unique);
        for (const target of unique) {
          inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
        }
      })
    );

    const ranked = targetBlobs
      .map((b) => {
        const isTestOrExample = /(^|\/)(test|tests|example|examples|bench|scripts|docs)\//i.test(b.path);
        const score =
          priorityScore(b.path) +
          (inDegree.get(b.path) ?? 0) * 6 +
          (outEdges.get(b.path)?.length ?? 0) * 3;
        return { ...b, score, isTestOrExample };
      })
      .sort((a, b) => b.score - a.score);

    const spineCount = Math.min(Math.max(12, Math.floor(ranked.length * 0.22)), 85);
    const spineBlobs = ranked.slice(0, spineCount);
    const spineIdByPath = new Map<string, string>();

    const archSpine = spineBlobs.map((b, i) => {
      const id = `gh-as-${i}`;
      spineIdByPath.set(b.path, id);
      const topDir = b.path.includes('/') ? b.path.split('/')[0] : 'root';
      return {
        id,
        label: basename(b.path),
        subtitle: b.path,
        category: topDir,
        ref: b.path,
        description: `${b.path} · ${(inDegree.get(b.path) ?? 0)} dependents · ${(outEdges.get(b.path)?.length ?? 0)} parsed imports`,
        url: `${htmlBase}/blob/${encodeURIComponent(defaultBranch)}/${b.path}`,
        featured: i === 0 || i % Math.max(4, Math.floor(spineBlobs.length / 10)) === 0,
        labelSide: (i % 2 === 0 ? 'left' : 'right') as 'left' | 'right',
      };
    });

    const archBranches: typeof histBranches = [];
    const archDust: typeof histDust = [];

    ranked.slice(spineCount).forEach((b, idx) => {
      const topDir = b.path.includes('/') ? b.path.split('/')[0] : 'module';
      const deps = outEdges.get(b.path) ?? [];
      const linkedSpine = deps.find((d) => spineIdByPath.has(d));

      if ((!b.isTestOrExample || linkedSpine) && archBranches.length < 220 && archSpine.length > 0) {
        const fromId = linkedSpine
          ? spineIdByPath.get(linkedSpine)!
          : archSpine[idx % archSpine.length].id;
        archBranches.push({
          id: `gh-ab-${idx}`,
          label: basename(b.path),
          category: topDir,
          ref: b.path,
          fromSpineId: fromId,
          side: topDir.charCodeAt(0) % 2 === 0 ? 'left' : 'right',
          depth: 0.34 + (idx % 7) * 0.08,
          description: `${b.path} (${b.size ? `${Math.round(b.size / 1024)} KB` : 'source file'})`,
          url: `${htmlBase}/blob/${encodeURIComponent(defaultBranch)}/${b.path}`,
          featured: idx < 12,
        });
      } else {
        archDust.push({
          id: `gh-ad-${idx}`,
          label: b.path,
          category: b.isTestOrExample ? 'Test / Example' : 'Unreached File',
          ref: b.path,
          description: `Auxiliary or test file outside core spine (${b.path}).`,
          url: `${htmlBase}/blob/${encodeURIComponent(defaultBranch)}/${b.path}`,
        });
      }
    });

    res.json({
      owner,
      repo: repoInfo.name || repo,
      description: repoInfo.description || `Live GitHub repository analysis for ${owner}/${repo}.`,
      defaultBranch,
      stars: repoInfo.stargazers_count,
      sourceKind: 'github',
      fetchedAt: new Date().toISOString(),
      architecture: {
        spineTitle: `${archSpine.length}-file core architecture spine`,
        branchTitle: 'Sample of parsed module imports & subsystem files',
        dustTitle: 'Tests, examples & unreached repository files',
        totalFiles: blobs.length || targetBlobs.length,
        spine: archSpine,
        branches: archBranches,
        dust: archDust,
      },
      history: {
        spineTitle: `${histSpine.length}-commit first-parent ${defaultBranch} spine`,
        branchTitle: 'Sample of side-branch commits & merged feature arcs',
        dustTitle: 'Parallel & unmerged remote branches',
        totalCommits: commits.length,
        spine: histSpine,
        branches: histBranches,
        dust: histDust,
      },
    });
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';
  const disableHmr = process.env.DISABLE_HMR === 'true';

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });

    if (disableHmr) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (transformed?.code) {
            const patched = transformed.code
              .replace(
                /transport\.connect\(createHMRHandler\([^)]*\)\);?/g,
                '/* HMR disabled: WebSocket transport suppressed */'
              )
              .replace(
                /setupForwardConsoleHandler\(transport,\s*forwardConsole\);?/g,
                '/* HMR disabled: console forwarding suppressed */'
              );
            res.type('application/javascript').send(patched);
            return;
          }
        } catch {
          // fall through to Vite middleware
        }
        next();
      });
    }

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`ArborTrace server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
