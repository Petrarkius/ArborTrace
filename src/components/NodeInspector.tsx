import { ExternalLink, X } from 'lucide-react';
import { ArchaeologyGraph, LayoutNode } from '../types/graph';

interface NodeInspectorProps {
  graph: ArchaeologyGraph;
  node: LayoutNode;
  onClose: () => void;
  onJumpToNode: (node: LayoutNode) => void;
}

export function NodeInspector({
  graph,
  node,
  onClose,
  onJumpToNode,
}: NodeInspectorProps) {
  const connected = node.connectedIds
    .map((id) => graph.nodeMap[id])
    .filter((n): n is LayoutNode => Boolean(n))
    .slice(0, 10);

  const safeHref =
    node.url && /^https?:\/\//i.test(node.url) ? node.url : undefined;

  return (
    <aside className="w-full sm:w-[320px] shrink-0 h-full overflow-y-auto bg-[#0b0c15] border-l border-white/10 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-mono text-slate-400">
            {node.kind === 'spine'
              ? 'Trunk Milestone'
              : node.kind === 'branch'
                ? 'Branch Filament'
                : 'Peripheral Dust'}
            {typeof node.spineIndex === 'number' ? ` · Step ${node.spineIndex + 1}` : ''}
          </div>
          <h3 className="text-base font-semibold text-white break-words">
            {node.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="border-t border-white/10 pt-3 space-y-2.5 text-xs">
        <div>
          <div className="text-slate-400 mb-0.5">Category</div>
          <div className="font-mono text-slate-200">{node.category}</div>
        </div>
        <div>
          <div className="text-slate-400 mb-0.5">Reference</div>
          <div className="font-mono text-slate-200 break-all">{node.ref}</div>
        </div>
        {node.author || node.timestamp ? (
          <div className="flex items-center gap-2 text-slate-300 font-mono">
            {node.author ? <span>@{node.author}</span> : null}
            {node.author && node.timestamp ? <span aria-hidden="true">·</span> : null}
            {node.timestamp ? <span>{node.timestamp}</span> : null}
          </div>
        ) : null}
        {node.description ? (
          <div>
            <div className="text-slate-400 mb-1">Context</div>
            <p className="text-slate-300 leading-relaxed">{node.description}</p>
          </div>
        ) : null}
      </div>

      {safeHref ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/8 hover:bg-white/14 border border-white/15 rounded-md transition-colors"
        >
          <span>Open on GitHub</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : null}

      <div className="border-t border-white/10 pt-3 space-y-2">
        <div className="text-xs font-semibold text-slate-200">
          Connected Filaments ({node.connectedIds.length})
        </div>
        {connected.length === 0 ? (
          <p className="text-xs text-slate-500">
            Disconnected element in peripheral dust layer.
          </p>
        ) : (
          <div className="space-y-1">
            {connected.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => onJumpToNode(target)}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#06060c] hover:bg-white/8 border border-white/10 transition-colors flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="text-xs font-mono text-slate-200 truncate">
                  {target.label}
                </span>
                <span className="text-[11px] font-mono text-slate-500 shrink-0">
                  {target.kind}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
