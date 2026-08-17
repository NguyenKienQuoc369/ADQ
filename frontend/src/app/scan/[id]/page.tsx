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
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chi tiết scan</h1>
          <p className="text-sm text-zinc-600">
            Scan ID: <span className="font-mono">{scan.scanId}</span>
          </p>
          <p className="text-sm text-zinc-600">Domain: {scan.targetDomain}</p>
          <p className="text-sm text-zinc-600">Status: {scan.status}</p>
          <p className="text-sm text-zinc-600">Started: {formatDate(scan.startedAt)}</p>
        </div>
        <Link href="/" className="text-blue-600 underline">
          Quay lại
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Live Hosts</h2>
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Title</th>
              </tr>
            </thead>
            <tbody>
              {scan.liveHosts.map((host) => (
                <tr key={host.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{host.url ?? "-"}</td>
                  <td className="px-4 py-3">{host.statusCode ?? "-"}</td>
                  <td className="px-4 py-3">{host.title ?? "-"}</td>
                </tr>
              ))}
              {scan.liveHosts.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                    Không có live host.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Vulnerabilities</h2>
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Template ID</th>
                <th className="px-4 py-3">Matched URL</th>
              </tr>
            </thead>
            <tbody>
              {scan.vulnerabilities.map((vuln) => (
                <tr key={vuln.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{vuln.severity ?? "-"}</td>
                  <td className="px-4 py-3">{vuln.templateId ?? "-"}</td>
                  <td className="px-4 py-3">{vuln.matched ?? vuln.endpoint ?? "-"}</td>
                </tr>
              ))}
              {scan.vulnerabilities.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                    Không có vulnerability.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
