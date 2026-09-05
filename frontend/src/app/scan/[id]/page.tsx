import Link from "next/link";
import { notFound } from "next/navigation";

import { getPrismaClient } from "@/lib/prisma";

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("vi-VN");
}

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const prisma = getPrismaClient();

  const scan = await prisma.scanJob.findUnique({
    where: { scanId: id },
    include: {
      liveHosts: {
        orderBy: { createdAt: "desc" },
      },
      vulnerabilities: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!scan) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#000000] text-[#ededed] font-sans p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-semibold text-white">Chi tiết phiên rà quét</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-400 font-mono">
              <span>Scan ID: <span className="text-white">{scan.scanId}</span></span>
              <span>•</span>
              <span>Target: <span className="text-white">{scan.targetDomain}</span></span>
              <span>•</span>
              <span>Bắt đầu: {formatDate(scan.startedAt)}</span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="h-8 inline-flex items-center border border-[#333333] bg-[#111111] hover:bg-neutral-800 text-neutral-300 text-xs px-3 rounded-md transition"
          >
            Quay lại Dashboard
          </Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Live Hosts</h2>
          <div className="overflow-x-auto rounded-lg border border-[#222222] bg-[#000000]">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#0a0a0a] text-neutral-500 font-mono">
                <tr>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {scan.liveHosts.map((host) => (
                  <tr key={host.id} className="hover:bg-neutral-900/40">
                    <td className="px-4 py-3 font-mono text-white">{host.url ?? "-"}</td>
                    <td className="px-4 py-3 font-mono text-neutral-300">{host.statusCode ?? "-"}</td>
                    <td className="px-4 py-3 text-neutral-400">{host.title ?? "-"}</td>
                  </tr>
                ))}
                {scan.liveHosts.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-neutral-500 font-mono text-center" colSpan={3}>
                      Không có live host.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Vulnerabilities</h2>
          <div className="overflow-x-auto rounded-lg border border-[#222222] bg-[#000000]">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#0a0a0a] text-neutral-500 font-mono">
                <tr>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Template ID</th>
                  <th className="px-4 py-3 font-medium">Matched URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {scan.vulnerabilities.map((vuln) => (
                  <tr key={vuln.id} className="hover:bg-neutral-900/40">
                    <td className="px-4 py-3 font-mono">
                      <span className="border border-neutral-700 bg-neutral-800 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {vuln.severity ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white">{vuln.templateId ?? "-"}</td>
                    <td className="px-4 py-3 font-mono text-neutral-400">{vuln.matched ?? vuln.endpoint ?? "-"}</td>
                  </tr>
                ))}
                {scan.vulnerabilities.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-neutral-500 font-mono text-center" colSpan={3}>
                      Không có vulnerability.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
