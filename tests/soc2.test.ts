import { describe, expect, test } from "vitest";
import { generateSoc2Checklist } from "../netlify/functions/_lib/soc2";

describe("generateSoc2Checklist", () => {
  test("marks controls as failing when their corresponding finding is present", () => {
    const checklist = generateSoc2Checklist([
      {
        category: "transport",
        description: "x",
        id: "https-not-used",
        severity: "high",
        title: "x"
      },
      {
        category: "security-headers",
        description: "x",
        id: "missing-hsts",
        severity: "medium",
        title: "x"
      }
    ]);

    const failing = checklist.items.filter((item) => !item.passing).map((item) => item.id);
    expect(failing).toContain("soc2-https");
    expect(failing).toContain("soc2-hsts");
    expect(checklist.passed).toBe(checklist.total - 2);
  });

  test("marks every control as passing when no findings are present", () => {
    const checklist = generateSoc2Checklist([]);
    expect(checklist.passed).toBe(checklist.total);
    expect(checklist.items.every((item) => item.passing)).toBe(true);
  });
});
