"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  UploadCloud,
  FileCode2,
  LoaderCircle,
  Save,
  BookmarkCheck,
  PlusCircle,
  Lock,
} from "lucide-react";
import { getProjectById, saveProjectDetail } from "@/lib/api";
import { RescanConfirmModal } from "@/components/scan/rescan-confirm-modal";

interface ApkAnalysisResult {
  packageName: string;
  versionName: string;
  minSdkVersion: number;
  targetSdkVersion: number;
  permissions: string[];
  vulnerabilities: {
    title: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
  }[];
  hardcodedSecrets: string[];
}

function ApkAuditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const { user } = useAuth();
  const isAllowed = user?.packageTier === "PRO_MAX" || (user?.packageTier as string) === "ENTERPRISE";

  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ApkAnalysisResult | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [showRescanModal, setShowRescanModal] = useState(false);

  // Tải dữ liệu phiên APK cũ nếu có projectId
  useEffect(() => {
    if (!projectId) return;

    getProjectById(projectId)
      .then((p) => {
        if (!p) return;
        setProjectName(p.name || "");
        const summary = (p.projectDetail?.summary as Record<string, any>) || {};
        if (summary.apkAudit) {
          setAnalysisResult(summary.apkAudit);
        }
      })
      .catch((e) => console.warn("Load APK detail error:", e));
  }, [projectId]);

  if (!isAllowed) {
    return (
      <DashboardShell area="dashboard">
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center max-w-lg mx-auto font-sans">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 mb-4 shadow-lg shadow-purple-950/50">
            <Shield className="h-8 w-8"/>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-mono mb-3">
            TÍNH NĂNG DÀNH RIÊNG CHO GÓI PRO MAX
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Kiểm Toán An Ninh Mobile APK</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Tính năng phân tích dịch ngược APK, phát hiện mã độc và kiểm toán phân quyền chỉ khả dụng trên gói <span className="text-purple-400 font-bold">PRO MAX</span>.
          </p>
          <Button onClick={() => router.push("/dashboard/billing")}
            className="h-10 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-950/50"
          >
            Nâng Cấp PRO MAX Ngay
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const handleSaveSession = async () => {
    if (!projectId) {
      alert("Vui lòng gắn một Project ID hoặc tạo dự án để lưu phiên này.");
      return;
    }
    setIsSaving(true);
    try {
      await saveProjectDetail(projectId, {
        apkAudit: analysisResult,
      });
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    } catch (e) {
      console.error("Save APK audit failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadClick = () => {
    if (isAnalyzing || !file) return;

    const hasExistingData = analysisResult !== null;
    const isSuppressed =
      typeof window !== "undefined" &&
      localStorage.getItem("adq_suppress_rescan_warning") === "true";

    if (hasExistingData && !isSuppressed) {
      setShowRescanModal(true);
      return;
    }

    startAnalysis();
  };

  const startAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);

    setTimeout(async () => {
      const mockResult: ApkAnalysisResult = {
        packageName: "com.example.secureapp",
        versionName: "1.0.4-prod",
        minSdkVersion: 24,
        targetSdkVersion: 33,
        permissions: [
          "android.permission.INTERNET",
          "android.permission.ACCESS_FINE_LOCATION",
          "android.permission.READ_EXTERNAL_STORAGE",
          "android.permission.CAMERA",
        ],
        vulnerabilities: [
          {
            title: "AllowBackup Flag Enabled in Manifest",
            severity: "HIGH",
            description: "Ứng dụng cho phép sao lưu dữ liệu ADB qua cờ android:allowBackup=true, tiềm ẩn nguy cơ trích xuất dữ liệu nhạy cảm.",
          },
          {
            title: "Insecure TLS/SSL TrustManager Implementation",
            severity: "CRITICAL",
            description: "Phát hiện mã nguồn bỏ qua kiểm tra chứng chỉ X.509, mở đường cho tấn công Man-in-the-Middle (MitM).",
          },
        ],
        hardcodedSecrets: [
          "AIzaSyD-mockFirebaseApiKey9920129",
          "jwt_signing_secret_dev_key_2026",
        ],
      };

      setAnalysisResult(mockResult);
      setIsAnalyzing(false);

      if (projectId) {
        await saveProjectDetail(projectId, {
          apkAudit: mockResult,
        });
      }
    }, 3000);
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-slate-100 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-purple-400"/> Dịch Ngược & Kiểm Toán File APK
              </h1>
              {projectId && (
                <Badge className="text-[10px] font-mono border border-purple-500/30 text-purple-400 bg-purple-950/40">
                  DỰ ÁN: {projectName || projectId}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Phân tích tĩnh tệp nhị phân Android, bóc tách Secret Keys, cờ Manifest và lỗ hổng mã nguồn
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button className="h-8 text-xs border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60" disabled={isSaving || isAnalyzing || !analysisResult} onClick={handleSaveSession} size="sm" variant="outline">
              {isSaving ? (
                <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin"/>
              ) : isSavedSuccess ? (
                <BookmarkCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400"/>
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5"/>
              )}
              {isSavedSuccess ? "Đã Lưu Phiên" : "Lưu Kết Quả"}
            </Button>

            <Button onClick={() => router.push("/dashboard/projects")} size="sm" variant="outline"
              className="h-8 text-xs border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-cyan-400"/> Phiên Mới
            </Button>
          </div>
        </div>

        {/* Upload Zone */}
        <Card className="border border-white/[0.08] bg-slate-950/80">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl p-8 bg-slate-900/30 text-center hover:border-purple-500/40 transition-colors">
              <UploadCloud className="h-10 w-10 text-purple-400 mb-3"/>
              <p className="text-sm font-bold text-white mb-1">Tải lên tệp APK Android (.apk)</p>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Hệ thống sẽ tiến hành Decompile bằng Jadx/Apktool và đối chiếu chữ ký bảo mật
              </p>
              <input
                type="file"
                accept=".apk"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
              />
              {file && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs font-mono text-purple-300">
                    {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <Button className="h-8 px-4 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg" disabled={isAnalyzing} onClick={handleUploadClick}>
                    {isAnalyzing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1"/> : null}
                    {isAnalyzing ? "Đang Dịch Ngược..." : "Bắt Đầu Kiểm Toán"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Package Details */}
              <Card className="border border-white/[0.08] bg-slate-950/80 p-4 space-y-2">
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-400"/> Thông Tin Ứng Dụng
                </p>
                <div className="text-xs space-y-1 text-slate-300 font-mono">
                  <p>
                    Package: <span className="text-cyan-300">{analysisResult.packageName}</span>
                  </p>
                  <p>
                    Version: <span className="text-cyan-300">{analysisResult.versionName}</span>
                  </p>
                  <p>
                    Target SDK: <span className="text-cyan-300">{analysisResult.targetSdkVersion}</span> (Min:{" "}
                    {analysisResult.minSdkVersion})
                  </p>
                </div>
              </Card>

              {/* Hardcoded Secrets */}
              <Card className="border border-white/[0.08] bg-slate-950/80 p-4 space-y-2">
                <p className="text-xs font-bold text-rose-400 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-rose-400"/> Hardcoded Secrets Phát Hiện
                </p>
                <div className="space-y-1">
                  {analysisResult.hardcodedSecrets.map((s, i) => (
                    <div
                      key={i}
                      className="rounded bg-rose-950/30 border border-rose-500/20 px-2 py-1 font-mono text-[11px] text-rose-300"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Vulnerabilities */}
            <Card className="border border-white/[0.08] bg-slate-950/80">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-bold text-white">Lỗ Hổng Code & Phân Quyền</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-800">
                {analysisResult.vulnerabilities.map((v, i) => (
                  <div key={i} className="p-3.5 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[9px] font-mono" variant={v.severity === "CRITICAL" || v.severity === "HIGH" ? "danger" : "default"}>
                        {v.severity}
                      </Badge>
                      <span className="font-bold text-slate-200">{v.title}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{v.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal Xác Nhận Ghi Đè */}
        <RescanConfirmModal isOpen={showRescanModal} onClose={() => setShowRescanModal(false)}
          onConfirm={(dontShowAgain) => {
            if (dontShowAgain && typeof window !== "undefined") {
              localStorage.setItem("adq_suppress_rescan_warning", "true");
            }
            setShowRescanModal(false);
            startAnalysis();
          }}
          onCreateNewSession={() => {
            setShowRescanModal(false);
            router.push("/dashboard/projects");
          }}
        />
      </div>
    </DashboardShell>
  );
}

export default function ApkAuditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <ApkAuditContent/>
    </Suspense>
  );
}
