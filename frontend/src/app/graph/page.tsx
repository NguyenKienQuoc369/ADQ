"use client";

import { useState, useEffect } from "react";
import { 
  Network, 
  Search, 
  ShieldAlert, 
  Key, 
  Globe, 
  Code, 
  X, 
  ArrowRight, 
  Zap, 
  ExternalLink,
  Layers,
  Info
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface NodeData {
  id: string;
  label: string;
  type: string;
  risk: number;
}

interface EdgeData {
  source: string;
  target: string;
  type: string;
}

export default function KnowledgeGraphExplorer() {
  const { t } = useLanguage();
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [topologyRisk, setTopologyRisk] = useState(91);
  const [loading, setLoading] = useState(true);

  // Path Query State
  const [fromNode, setFromNode] = useState("secret:JWT_EXPOSED_KEY");
  const [toNode, setToNode] = useState("domain:target-enterprise.com");
  const [impactPath, setImpactPath] = useState<string[]>([]);

  // Selected Node Drawer State
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  const fetchGraph = async (pathQuery = false) => {
    setLoading(true);
    try {
      const url = pathQuery
        ? `/api/graph/data?from=${encodeURIComponent(fromNode)}&to=${encodeURIComponent(toNode)}`
        : "/api/graph/data";
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setNodes(data.data.nodes);
        setEdges(data.data.edges);
        setTopologyRisk(data.data.topologyRiskScore);
        if (data.data.impactPath) {
          setImpactPath(data.data.impactPath);
        }
      }
    } catch (err) {
      console.error("Failed to load knowledge graph", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph(true);
  }, []);

  const handleQueryPath = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGraph(true);
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6 font-sans relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-500" />
            {t("graph.title")}
          </h1>
          <p className="text-sm text-zinc-400 font-mono mt-1">
            {t("graph.subtitle")}
          </p>
        </div>

        {/* Topology Risk Score Badge */}
        <div className="flex items-center gap-3 font-mono">
          <div className="bg-red-950/80 border border-red-800 px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg">
            <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
            <div>
              <div className="text-[10px] text-red-400 uppercase tracking-wider">{t("graph.riskScore")}</div>
              <div className="text-lg font-bold text-red-200">{topologyRisk} / 100 (CRITICAL)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Path Query Bar */}
      <form onSubmit={handleQueryPath} className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-xl">
        <div className="flex-1 flex items-center gap-2 w-full font-mono text-xs">
          <label className="text-zinc-400 text-nowrap">{t("graph.fromLeak")}</label>
          <input
            type="text"
            value={fromNode}
            onChange={(e) => setFromNode(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <ArrowRight className="hidden md:block h-5 w-5 text-zinc-600" />

        <div className="flex-1 flex items-center gap-2 w-full font-mono text-xs">
          <label className="text-zinc-400 text-nowrap">{t("graph.toTarget")}</label>
          <input
            type="text"
            value={toNode}
            onChange={(e) => setToNode(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition text-nowrap"
        >
          <Search className="h-4 w-4" />
          Query Blast Radius Path
        </button>
      </form>

      {/* Impact Path Highlights Banner */}
      {impactPath.length > 0 && (
        <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 font-mono text-xs text-red-200 space-y-2 shadow-lg">
          <div className="font-bold flex items-center gap-2 text-red-400">
            <Zap className="h-4 w-4 fill-red-400 text-red-400" />
            Traversed Threat Impact Path (Blast Radius Chain):
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {impactPath.map((step, idx) => (
              <div key={step} className="flex items-center gap-2">
                <span className="bg-zinc-950 border border-red-700/60 px-2.5 py-1 rounded text-red-300 font-semibold shadow">
                  {step}
                </span>
                {idx < impactPath.length - 1 && <ArrowRight className="h-4 w-4 text-red-500" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Knowledge Graph Canvas Container */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-2xl relative min-h-[480px] flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800 pb-3">
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-400" />
            Knowledge Graph Visualization Nodes ({nodes.length} Nodes, {edges.length} Edges)
          </span>
          <span className="text-[11px] text-zinc-500">Click any Node to open Details Drawer</span>
        </div>

        {/* Node Grid Canvas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
          {nodes.map((node) => {
            const isPathMember = impactPath.includes(node.id);
            const isSelected = selectedNode?.id === node.id;

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 font-mono shadow-md ${
                  isPathMember
                    ? "bg-red-950/40 border-red-600 shadow-red-950/50 hover:border-red-400"
                    : isSelected
                    ? "bg-blue-950/40 border-blue-500 hover:border-blue-400"
                    : "bg-zinc-950 border-zinc-800/80 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      node.type === "SECRET"
                        ? "bg-purple-950 text-purple-400 border border-purple-800"
                        : node.type === "VULNERABILITY"
                        ? "bg-red-950 text-red-400 border border-red-800"
                        : node.type === "DOMAIN"
                        ? "bg-blue-950 text-blue-400 border border-blue-800"
                        : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    }`}
                  >
                    {node.type}
                  </span>

                  <span className="text-[10px] font-bold text-amber-400">Risk {node.risk}/100</span>
                </div>

                <div className="text-xs font-semibold text-white truncate" title={node.label}>
                  {node.label}
                </div>

                <div className="text-[11px] text-zinc-500 mt-2 flex items-center justify-between">
                  <span>ID: {node.id.split(":")[0]}</span>
                  {isPathMember && (
                    <span className="text-red-400 text-[10px] font-bold animate-pulse">
                      CRITICAL PATH
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Node Details Sliding Sidebar Drawer */}
      {selectedNode && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 p-6 flex flex-col justify-between font-mono animate-slide-in">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                <h3 className="font-bold text-base text-white">Node Details Panel</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-500 block mb-1">Node Identifier:</label>
                <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded font-semibold text-zinc-200 break-all">
                  {selectedNode.id}
                </div>
              </div>

              <div>
                <label className="text-zinc-500 block mb-1">Label / Asset Name:</label>
                <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded font-semibold text-white break-all">
                  {selectedNode.label}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 block mb-1">Type:</label>
                  <div className="bg-zinc-950 border border-zinc-800 p-2 rounded text-blue-400 font-bold">
                    {selectedNode.type}
                  </div>
                </div>

                <div>
                  <label className="text-zinc-500 block mb-1">Risk Score:</label>
                  <div className="bg-zinc-950 border border-zinc-800 p-2 rounded text-red-400 font-bold">
                    {selectedNode.risk} / 100
                  </div>
                </div>
              </div>

              {/* Sample Headers & Params Mock */}
              <div>
                <label className="text-zinc-500 block mb-1">Discovered Headers & Metadata:</label>
                <pre className="bg-zinc-950 border border-zinc-800 p-3 rounded text-[11px] text-zinc-300 font-mono overflow-x-auto">
{`{
  "X-Discovered-By": "ADQ-Graph-Engine",
  "Auth-Required": true,
  "Connected-Edges": 3,
  "Impact-Path-Traversed": true
}`}
                </pre>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <button
              onClick={() => setSelectedNode(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-2.5 rounded-lg text-xs transition"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
