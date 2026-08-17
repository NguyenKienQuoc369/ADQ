"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckSquare,
  Cpu,
  Play,
  RefreshCw,
  Square,
  Terminal,
  Upload,
  Zap,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ModuleFrame, ModuleSection } from "@/components/workspace/module-frame";
import { formatDateTime } from "@/lib/utils";

interface WorkerNode {
  workerId: string;
  capability: string;
  profile: string;
  currentTask: string;
  status: string;
  cpuUsage: string;
  ramUsage: string;
  lastHeartbeat: string;
}

export default function C2CommandCenter() {
  const [bulkTargets, setBulkTargets] = useState("");
  const [profiles, setProfiles] = useState({
    recon_infra: true,
    web_mapping: true,
    dast_active: false,
    deep_logic: false,
  });
  const [capability, setCapability] = useState("all-nodes");
  const [priority, setPriority] = useState(10);
  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [dispatchResult, setDispatchResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
    jobs?: Array<{ scanId: string; targetDomain: string; status: string }>;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const activeProfiles = useMemo(
    () => Object.entries(profiles).filter(([, active]) => active).map(([key]) => key),
    [profiles],
  );

  useEffect(() => {
    let mounted = true;
    const eventSource = new EventSource("/api/grid/workers/stream");

    eventSource.onopen = () => {
      if (!mounted) return;
      setSseConnected(true);
      setIsLoadingWorkers(false);
    };

    eventSource.onmessage = (event) => {
      if (!mounted) return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.ok && parsed.workers) {
          setWorkers(parsed.workers);
          setIsLoadingWorkers(false);
        }
      } catch (error) {
        console.error("Không thể parse grid stream", error);
      }
    };

    eventSource.onerror = () => {
      if (!mounted) return;
      setSseConnected(false);
      setIsLoadingWorkers(false);
      eventSource.close();
    };

    return () => {
      mounted = false;
      eventSource.close();
    };
  }, []);

  const fetchWorkersManual = async () => {
    setIsLoadingWorkers(true);
    try {
      const response = await fetch("/api/grid/workers");
      const data = await response.json();
      if (data.ok) {
        setWorkers(data.workers);
      }
    } catch (error) {
      console.error("Không thể tải workers", error);
    } finally {
      setIsLoadingWorkers(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result as string;
      setBulkTargets((prev) => (prev ? `${prev}\n${text}` : text));
    };
    reader.readAsText(file);
  };

  const handleDispatch = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setDispatchResult(null);

    const targets = bulkTargets
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/c2/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets,
          profiles: activeProfiles,
          capability,
          priority,
        }),
      });
      const data = await response.json();
      setDispatchResult(data);
      await fetchWorkersManual();
    } catch (error) {
      setDispatchResult({
        ok: false,
        error: error instanceof Error ? error.message : "Không thể dispatch job.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProfile = (key: keyof typeof profiles) => {
    setProfiles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <DashboardShell area="dashboard">
      <ModuleFrame
        icon={Terminal}
        eyebrow="Security Modules"
        title="C2 Command Center"
        description="Điểm điều phối trung tâm cho toàn bộ pipeline. Từ đây bạn ingest target, chọn profile scan, gửi job tới grid và theo dõi worker theo thời gian thực."
        stats={[
          { label: "Workers online", value: String(workers.length), variant: "success" },
          { label: "SSE stream", value: sseConnected ? "Active" : "Fallback", variant: sseConnected ? "success" : "warning" },
          { label: "Profiles bật", value: String(activeProfiles.length), variant: "default" },
          { label: "Priority", value: `${priority}/100`, variant: "muted" },
        ]}
        links={[
          { href: "/ctem", label: "Xem delta tài sản trong CTEM" },
          { href: "/vulnerabilities", label: "Đi tới Vulnerability Inbox" },
        ]}
      >
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <ModuleSection title="Target ingestion" description="Bulk import target, kích hoạt profile và gửi vào master grid.">
            <form className="space-y-5" onSubmit={handleDispatch}>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200">Danh sách target</label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-cyan-300">
                    <Upload className="h-3.5 w-3.5" />
                    Nạp từ file `.txt`
                    <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                <Textarea
                  rows={7}
                  value={bulkTargets}
                  onChange={(event) => setBulkTargets(event.target.value)}
                  placeholder={"target1.com\ntarget2.com\napi.target3.com"}
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-200">Scan profiles</label>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { key: "recon_infra", title: "Recon Infra", desc: "Subdomain, DNS, discovery nhẹ." },
                    { key: "web_mapping", title: "Web Mapping", desc: "HTTP probing, stack tagging, URL history." },
                    { key: "dast_active", title: "DAST Active", desc: "Nuclei/CVE scanning chủ động." },
                    { key: "deep_logic", title: "Deep Logic", desc: "Logic flaw, OAST, parameter fuzzing." },
                  ].map((item) => {
                    const checked = profiles[item.key as keyof typeof profiles];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleProfile(item.key as keyof typeof profiles)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          checked ? "border-cyan-500/30 bg-cyan-500/10" : "border-slate-800 bg-slate-900/70"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {checked ? <CheckSquare className="mt-0.5 h-4 w-4 text-cyan-300" /> : <Square className="mt-0.5 h-4 w-4 text-slate-500" />}
                          <div>
                            <p className="font-medium text-slate-100">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Node capability</label>
                  <Select value={capability} onChange={(event) => setCapability(event.target.value)}>
                    <option value="all-nodes">all-nodes</option>
                    <option value="light-fast">light-fast</option>
                    <option value="elite-clean-ip">elite-clean-ip</option>
                  </Select>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-200">Dispatch priority</label>
                    <span className="text-sm font-semibold text-cyan-300">{priority}</span>
                  </div>
                  <Input type="range" min="1" max="100" value={priority} onChange={(event) => setPriority(Number(event.target.value))} className="h-11 px-0" />
                </div>
              </div>

              <Button className="w-full" type="submit" disabled={isSubmitting || activeProfiles.length === 0 || !bulkTargets.trim()}>
                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Dispatch lên Master Grid
              </Button>

              {dispatchResult ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    dispatchResult.ok
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    <span>{dispatchResult.ok ? "Dispatch thành công" : "Dispatch thất bại"}</span>
                  </div>
                  <p className="mt-2">{dispatchResult.message ?? dispatchResult.error}</p>
                  {dispatchResult.jobs?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dispatchResult.jobs.map((job) => (
                        <Badge key={job.scanId} variant="muted">
                          {job.targetDomain}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </form>
          </ModuleSection>

          <ModuleSection title="Worker grid monitor" description="Realtime worker heartbeat, current task và mức sử dụng tài nguyên.">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={sseConnected ? "success" : "warning"}>{sseConnected ? "SSE Active" : "Polling Fallback"}</Badge>
                <span className="text-sm text-slate-400">Liên kết trực tiếp với dispatch, CTEM và vulnerability flow.</span>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchWorkersManual}>
                <RefreshCw className={`h-4 w-4 ${isLoadingWorkers ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {workers.map((worker) => {
                const working = worker.status === "WORKING";
                return (
                  <div key={worker.workerId} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">{worker.workerId}</p>
                        <p className="text-sm text-slate-400">{worker.profile}</p>
                      </div>
                      <Badge variant={working ? "success" : "muted"}>{worker.status}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <Row label="Capability" value={worker.capability} />
                      <Row label="Current task" value={worker.currentTask} />
                      <Row label="CPU / RAM" value={`${worker.cpuUsage} / ${worker.ramUsage}`} />
                      <Row label="Heartbeat" value={formatDateTime(worker.lastHeartbeat)} />
                    </div>
                  </div>
                );
              })}
            </div>

            {isLoadingWorkers && workers.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400">
                Đang chờ worker grid heartbeat...
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-300" />
                <p className="text-sm font-medium text-slate-100">Hành trình liên kết</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <JourneyCard
                  icon={Zap}
                  title="Dispatch"
                  text="Gửi target lên grid và khởi tạo job trong hệ thống."
                />
                <JourneyCard
                  icon={Activity}
                  title="Observe"
                  text="Theo dõi worker rồi chuyển sang CTEM để xem bề mặt tấn công vừa phát sinh."
                />
                <JourneyCard
                  icon={Terminal}
                  title="Investigate"
                  text="Từ CTEM hoặc Inbox, đẩy endpoint sang fuzzing và triage lỗ hổng."
                />
              </div>
            </div>
          </ModuleSection>
        </div>
      </ModuleFrame>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-slate-200">{value}</span>
    </div>
  );
}

function JourneyCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Zap;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <p className="font-medium text-slate-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}
