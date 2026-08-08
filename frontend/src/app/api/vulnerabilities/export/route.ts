import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { vulnerability, format } = body;

    if (!vulnerability) {
      return NextResponse.json({ ok: false, error: "Vulnerability data is required" }, { status: 400 });
    }

    if (format === "markdown") {
      const markdown = `# [BUG REPORT] ${vulnerability.title} (${vulnerability.cveId || "CUSTOM-VULN"})

## Summary
A **${vulnerability.severity}** severity vulnerability was discovered on \`${vulnerability.host}\` during an automated ADQ Security Audit.

- **Target Domain:** \`${vulnerability.host}\`
- **Vulnerable Endpoint:** \`${vulnerability.endpoint}\`
- **CVSS Score:** ${vulnerability.cvss || 8.0}
- **Discovery Engine:** ${vulnerability.source}

## Steps to Reproduce (PoC)

Send the following HTTP request to the target server:

\`\`\`http
${vulnerability.rawRequest}
\`\`\`

## Vulnerable HTTP Response Received

\`\`\`http
${vulnerability.rawResponse}
\`\`\`

${vulnerability.oastCorrelation ? `## Out-of-Band (OAST) Correlation Proof\n\n\`\`\`text\n${vulnerability.oastCorrelation}\n\`\`\`\n` : ""}
## Impact
Exploitation of this flaw allows an attacker to execute arbitrary commands or bypass authentication on the host.

## Suggested Remediation
1. Sanitize and validate all incoming inputs.
2. Enforce strict authorization checks on \`${vulnerability.endpoint}\`.
`;

      return new Response(markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="ADQ_Report_${vulnerability.cveId || "vuln"}.md"`,
        },
      });
    }

    return NextResponse.json(vulnerability);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
