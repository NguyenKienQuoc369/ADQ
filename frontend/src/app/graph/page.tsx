"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Info,
  Layers,
  Network,
  Search,
  ShieldAlert,
  X,
  Zap,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleFrame, ModuleSection } from "@/components/workspace/module-frame";

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
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [topologyRisk, setTopologyRisk] = useState(91);
  const [loading, setLoading] = useState(true);

  const [fromNode, setFromNode] = useState("secret:JWT_EXPOSED_KEY");
  const [toNode, setToNode] = useState("domain:target-enterprise.com");
  const [impactPath, setImpactPath] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  const loadGraph = async (pathQuery = false) => {
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
        setImpactPath(data.data.impactPath ?? []);
      }
    } catch (err) {
      console.error("Failed to load knowledge graph", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch(`/api/graph/data?from=${encodeURIComponent(fromNode)}&to=${encodeURIComponent(toNode)}`);
        const data = await res.json();
        if (active && data.ok) {
          setNodes(data.data.nodes);
          setEdges(data.data.edges);
          setTopologyRisk(data.data.topologyRiskScore);
          setImpactPath(data.data.impactPath ?? []);
        }
      } catch (err) {
        console.error("Failed to load knowledge graph", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQueryPath = (e: React.FormEvent) => {
    e.preventDefault();
    void loadGraph(true);
  };

  const summary = useMemo(
    () => ({
      nodes: nodes.length,
      edges: edges.length,
      path: impactPath.length,
      risk: `${topologyRisk}/100`,
    }),
    [edges.length, impactPath.length, nodes.length, topologyRisk],
  );

  return (
    <DashboardShell area="dashboard">
      <ModuleFrame
        icon={Network}
        eyebrow="Security Modules"
        title="Knowledge Graph Explorer"
        description="Đồ thị tri thức gom domain, endpoint và vulnerability vào cùng một mô hình để truy vết blast radius từ leak ban đầu đến target cuối."
        stats={[
          { label: "Nodes", value: String(summary.nodes), variant: "default" },
          { label: "Edges", value: String(summary.edges), variant: "muted" },
          { label: "Impact path", value: String(summary.path), variant: "warning" },
          { label: "Topology risk", value: summary.risk, variant: topologyRisk >= 80 ? "danger" : "success" },
        ]}
        links={[
          { href: "/ctem", label: "Mở CTEM Matrix" },
          { href: "/vulnerabilities", label: "Đi tới Vulnerability Inbox" },
          { href: "/dashboard/results", label: "Xem Scan Results & Reports" },
        ]}
      >
        <ModuleSection title="Blast radius query" description="Tìm đường lan truyền rủi ro giữa một secret/node khởi phát và target cuối.">
          <form onSubmit={handleQueryPath} className="grid gap-4 xl:grid-cols-[1fr_auto_1fr_auto]">
            <Input value={fromNode} onChange={(e) => setFromNode(e.target.value)} />
            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-slate-500" />
            </div>
            <Input value={toNode} onChange={(e) => setToNode(e.target.value)} />
            <Button type="submit">
              <Search className="h-4 w-4" />
              Query path
            </Button>
          </form>

          {impactPath.length > 0 ? (
            <div className="mt-5 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-rose-200">
                <Zap className="h-4 w-4" />
                Blast radius chain
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {impactPath.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <Badge variant="danger">{step}</Badge>
                    {index < impactPath.length - 1 ? <ArrowRight className="h-4 w-4 text-rose-400" /> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </ModuleSection>

        <ModuleSection title="Knowledge graph canvas" description="Các node bên dưới dùng chung dữ liệu scan; bấm từng node để xem chi tiết và metadata điều tra.">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
              Đang tải graph topology...
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Layers className="h-4 w-4 text-cyan-300" />
                  {nodes.length} nodes · {edges.length} edges
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm">
                  <ShieldAlert className="h-4 w-4 text-rose-300" />
                  <span className="text-rose-100">Topology risk {topologyRisk}/100</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {nodes.map((node) => {
                  const inPath = impactPath.includes(node.id);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className={`rounded-3xl border p-4 text-left transition ${
                        inPath
                          ? "border-rose-500/30 bg-rose-500/10"
                          : selectedNode?.id === node.id
                          ? "border-cyan-500/30 bg-cyan-500/10"
                          : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <Badge variant={node.type === "VULNERABILITY" ? "danger" : node.type === "DOMAIN" ? "default" : "success"}>
                          {node.type}
                        </Badge>
                        <span className="text-sm font-medium text-amber-300">Risk {node.risk}</span>
                      </div>
                      <p className="line-clamp-2 font-medium text-slate-100">{node.label}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{node.id}</span>
                        {inPath ? <span className="text-rose-300">Critical path</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </ModuleSection>

        {selectedNode ? (
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-slate-800 bg-slate-950/98 p-6 shadow-2xl">
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-cyan-300" />
                    <h3 className="text-lg font-semibold text-slate-50">Node details</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setSelectedNode(null)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <DrawerField label="Identifier" value={selectedNode.id} />
                  <DrawerField label="Label" value={selectedNode.label} />
                  <div className="grid grid-cols-2 gap-3">
                    <DrawerField label="Type" value={selectedNode.type} />
                    <DrawerField label="Risk" value={`${selectedNode.risk}/100`} />
                  </div>
                  <DrawerField
                    label="Metadata"
                    value={`{
  "X-Discovered-By": "ADQ-Graph-Engine",
  "Connected-Edges": ${edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length},
  "Impact-Path-Traversed": ${impactPath.includes(selectedNode.id)}
}`}
                    pre
                  />
                </div>
              </div>

              <Button variant="secondary" onClick={() => setSelectedNode(null)}>
                Đóng panel
              </Button>
            </div>
          </div>
        ) : null}
      </ModuleFrame>
    </DashboardShell>
  );
}

function DrawerField({ label, value, pre = false }: { label: string; value: string; pre?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      {pre ? <pre className="overflow-x-auto text-sm text-slate-200">{value}</pre> : <p className="break-all text-sm text-slate-200">{value}</p>}
    </div>
  );
}
