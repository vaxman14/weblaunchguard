import { errorResponse, parseJsonBody, requireMethod, type NetlifyEvent, type NetlifyResponse } from "./_lib/http";
import { requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";

type ExportReportRequest = {
  reportId?: string;
};

type ReportRow = {
  created_at: string;
  domain_id: string;
  id: string;
  payload: Record<string, unknown>;
  scan_type: string | null;
  score: number | null;
  status: string;
  summary: string | null;
  target_url: string | null;
};

type FindingRow = {
  category: string | null;
  description: string | null;
  evidence: Record<string, unknown> | null;
  remediation: string | null;
  severity: string | null;
  title: string;
};

type DomainRow = { hostname: string };

const fontWinAnsi = new Set(
  [
    ...Array.from({ length: 95 }, (_, index) => index + 32), // printable ASCII 0x20-0x7E
    0x2018, 0x2019, 0x201c, 0x201d, 0x2013, 0x2014, 0x2026, 0x2022 // common smart punctuation
  ]
);

// Map any non-WinAnsi characters to a safe ASCII fallback so the PDF doesn't
// render garbled glyphs.
function transliterate(value: string): string {
  let out = "";
  for (const character of value) {
    const point = character.codePointAt(0) ?? 32;
    if (point < 32 || point > 0x7e) {
      switch (point) {
        case 0x2018:
        case 0x2019:
          out += "'";
          break;
        case 0x201c:
        case 0x201d:
          out += '"';
          break;
        case 0x2013:
        case 0x2014:
          out += "-";
          break;
        case 0x2026:
          out += "...";
          break;
        case 0x2022:
          out += "*";
          break;
        default:
          out += "?";
      }
    } else if (fontWinAnsi.has(point)) {
      out += character;
    } else {
      out += "?";
    }
  }

  return out;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r?\n/g, " ");
}

function wrap(value: string, width: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;

    if (current.length === 0) {
      current = word;
      continue;
    }

    if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildLines(report: ReportRow, findings: FindingRow[], domain: DomainRow | null): string[] {
  const headerLines = [
    "Web Launch Guard report",
    `Hostname: ${domain?.hostname ?? "(unknown)"}`,
    `Target: ${report.target_url ?? "(unknown)"}`,
    `Scan type: ${report.scan_type ?? "passive"}`,
    `Risk score: ${report.score ?? "?"}`,
    `Created: ${new Date(report.created_at).toLocaleString()}`,
    ""
  ];

  const summaryLines = [
    "Summary",
    ...wrap(report.summary ?? "No summary recorded.", 95),
    ""
  ];

  const findingLines = findings.flatMap((finding, index) => {
    const evidenceText = finding.evidence?.note ? String(finding.evidence.note) : "Based on stored evidence.";
    return [
      `${index + 1}. [${finding.severity ?? "low"}] ${finding.title}`,
      ...wrap(`Category: ${finding.category ?? "general"}`, 95),
      ...wrap(`Description: ${finding.description ?? "No description recorded."}`, 95),
      ...wrap(`Evidence: ${evidenceText}`, 95),
      ...wrap(`Remediation: ${finding.remediation ?? "Review before launch."}`, 95),
      ""
    ];
  });

  return [...headerLines, ...summaryLines, "Findings", ...findingLines];
}

const linesPerPage = 56;

function buildPageContents(lines: string[]): string[] {
  const pages: string[] = [];

  for (let pageStart = 0; pageStart < lines.length; pageStart += linesPerPage) {
    const pageLines = lines.slice(pageStart, pageStart + linesPerPage);
    const stream = [
      "BT",
      "/F1 11 Tf",
      "50 780 Td",
      "14 TL",
      ...pageLines.flatMap((line) => [`(${escapePdfText(transliterate(line))}) Tj`, "T*"]),
      "ET"
    ].join("\n");

    pages.push(stream);
  }

  return pages.length > 0 ? pages : ["BT\n/F1 11 Tf\n50 780 Td\n(No content) Tj\nET"];
}

function createPdf(lines: string[]): Buffer {
  const pageStreams = buildPageContents(lines);
  const pageCount = pageStreams.length;

  // Object plan:
  //  1: Catalog
  //  2: Pages
  //  3..(2+pageCount): Page objects
  //  (3+pageCount): Font
  //  (4+pageCount)..(3+2*pageCount): Page contents
  const pageObjectIds = pageStreams.map((_, index) => 3 + index);
  const fontObjectId = 3 + pageCount;
  const contentObjectIds = pageStreams.map((_, index) => 4 + pageCount + index);

  const objects: string[] = [];
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`);

  for (let index = 0; index < pageCount; index += 1) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`
    );
  }
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);

  for (const stream of pageStreams) {
    const length = Buffer.byteLength(stream);
    objects.push(`<< /Length ${length} >>\nstream\n${stream}\nendstream`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "binary");
}

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const body = parseJsonBody<ExportReportRequest>(event);
  if (!body?.reportId) {
    return errorResponse("reportId is required.", 400);
  }

  const authResult = await requireAuthenticatedUser(event);
  if (authResult.response) {
    return authResult.response;
  }

  const client = serverSupabaseClient();

  const { data: reportRow, error: reportError } = await client
    .from("reports")
    .select("id,target_url,scan_type,summary,score,domain_id,status,payload,created_at")
    .eq("id", body.reportId)
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  if (reportError) {
    return errorResponse("Report lookup failed.", 500);
  }

  if (!reportRow) {
    return errorResponse("Report was not found for this account.", 404);
  }

  const report = reportRow as ReportRow;

  const { data: findingRows } = await client
    .from("findings")
    .select("category,description,evidence,remediation,severity,title")
    .eq("report_id", report.id)
    .order("created_at", { ascending: true });

  const findings = (findingRows as FindingRow[] | null) ?? [];

  const { data: domainRow } = await client
    .from("domains")
    .select("hostname")
    .eq("id", report.domain_id)
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  const lines = buildLines(report, findings, (domainRow as DomainRow | null) ?? null);
  const pdf = createPdf(lines);

  return {
    body: pdf.toString("base64"),
    headers: {
      "content-disposition": `attachment; filename="web-launch-guard-${report.id}.pdf"`,
      "content-type": "application/pdf"
    },
    isBase64Encoded: true,
    statusCode: 200
  };
}
