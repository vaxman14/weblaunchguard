import { describe, expect, test } from "vitest";
import { parseProAnalysisOutput } from "../netlify/functions/_lib/anthropic";

describe("parseProAnalysisOutput", () => {
  test("normalizes well-formed tool input from the model", () => {
    const result = parseProAnalysisOutput({
      findings: [
        {
          category: "Security headers",
          description: "HSTS is missing on the launch evidence.",
          evidence: "Response headers did not include strict-transport-security.",
          id: "ai-hsts",
          remediation: "Send Strict-Transport-Security with a 6+ month max-age.",
          severity: "medium",
          title: "HSTS should be enabled"
        }
      ],
      summary: "1 Pro finding generated."
    });

    expect(result.summary).toBe("1 Pro finding generated.");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].id).toBe("ai-hsts");
    expect(result.findings[0].severity).toBe("medium");
  });

  test("drops findings that are missing a title or description and caps the list at 8", () => {
    const findings = [
      ...Array.from({ length: 10 }, (_, index) => ({
        category: "ai",
        description: `desc ${index}`,
        evidence: "e",
        id: `ok-${index}`,
        remediation: "r",
        severity: "low",
        title: `t ${index}`
      })),
      { category: "ai", description: "missing title", severity: "high", title: "" }
    ];

    const result = parseProAnalysisOutput({ findings, summary: "" });
    expect(result.findings).toHaveLength(8);
    expect(result.findings.every((finding) => finding.title)).toBe(true);
    expect(result.summary).toBe("8 Pro findings generated.");
  });

  test("returns an empty list and synthesized summary on bogus input", () => {
    expect(parseProAnalysisOutput(undefined).findings).toEqual([]);
    expect(parseProAnalysisOutput({ findings: "nope" }).findings).toEqual([]);
  });
});
