# ArborTrace

**ArborTrace** is an interactive bioluminescent code archaeology visualizer inspired by `@b1rkh0ff`'s spine-and-branch dependency graph aesthetic of Riemann Hypothesis Lean Proof and `koaning/gitcharts`. It transforms software repositories—preloaded with `ggml-org/llama.cpp` and open to any live GitHub repository or local codebase upload—into a glowing vertical trunk with branch-pull curvature, curved subsystem/PR filaments, and peripheral dust, complete with full-curve hover inspection and 2400×3200 PNG poster export.


> *Vibe-coded within [aistudio.google.com](https://aistudio.google.com) with Gemini 4 Hydrogen.*

## Features

- **Dual Ingestion:** Fetch live public repositories from GitHub or analyze local project folders, `git log` text exports, and JSON files directly in the browser.
- **Two Archaeology Modes:** Switch between **Code Architecture** (core execution/dependency spine and module imports) and **Git History** (first-parent commit spine and merged feature arcs).
- **Interactive Canvas Explorer:** Smooth pan and cursor-anchored zoom, full-filament hover/click inspection, search-to-focus navigation, and branch-pull spine calibration controls.
- **Poster Export & Palettes:** Choose from four calibrated dark-field palettes and export publication-grade PNG posters with title metadata and legend.

---

## Deploy Locally via Docker (GHCR)

```bash
docker run -d \
  --name arbortrace \
  -p 3000:3000 \
  ghcr.io/Petrarkius/ArborTrace:latest
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Optional: Higher GitHub API Rate Limits

To increase live GitHub repository analysis limits beyond 60 requests/hour, pass a personal access token (with public read access) via `GITHUB_TOKEN`:

```bash
docker run -d \
  --name arbortrace \
  -p 3000:3000 \
  -e GITHUB_TOKEN=your_github_token \
  ghcr.io/Petrarkius/ArborTrace:latest
```

*(If your GHCR package is private, run `echo "$CR_PAT" | docker login ghcr.io -u <github-username> --password-stdin` first.)*

---

## Build & Run from Source

```bash
# Clone and enter repo
git clone https://github.com/Petrarkius/ArborTrace.git
cd ArborTrace

# With Docker
docker build -t arbortrace .
docker run -p 3000:3000 arbortrace

# Or with Node.js 22+
npm install
npm run dev
```
