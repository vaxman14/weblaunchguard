import { describe, expect, test } from "vitest";
import { analyzePassive, __testables } from "../netlify/functions/_lib/scan-engine";

const { hasUnlabeledFormControl, hasMetaCsp, setCookieValues } = __testables;

const baseHeaders = {
  "content-type": "text/html; charset=utf-8",
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'self'",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=()"
};

const goodHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Launch</h1>
    <img src="/logo.png" alt="Company logo">
    <form><label for="email">Email</label><input id="email" name="email"></form>
  </body>
</html>`;

describe("analyzePassive", () => {
  test("flags missing HSTS and CSP", () => {
    const report = analyzePassive({
      finalUrl: "https://example.com",
      headers: { ...baseHeaders, "strict-transport-security": "", "content-security-policy": "" },
      html: goodHtml,
      initialUrl: "https://example.com",
      status: 200
    });

    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["missing-hsts", "missing-csp"])
    );
  });

  test("does not flag CSP when supplied via meta http-equiv", () => {
    const html = `<html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"></head><body><h1>x</h1></body></html>`;
    const report = analyzePassive({
      finalUrl: "https://example.com",
      headers: { ...baseHeaders, "content-security-policy": "" },
      html,
      initialUrl: "https://example.com",
      status: 200
    });

    expect(report.findings.map((finding) => finding.id)).not.toContain("missing-csp");
  });

  test("flags cookies missing Secure/HttpOnly/SameSite when set-cookie is an array", () => {
    const report = analyzePassive({
      finalUrl: "https://example.com",
      headers: {
        ...baseHeaders,
        "set-cookie": [
          "session=abc; Path=/; HttpOnly; Expires=Wed, 09 Jun 2027 10:18:14 GMT",
          "csrf=xyz; Path=/; Secure"
        ]
      },
      html: goodHtml,
      initialUrl: "https://example.com",
      status: 200
    });

    const ids = report.findings.map((finding) => finding.id);
    expect(ids).toContain("cookie-missing-secure");
    expect(ids).toContain("cookie-missing-samesite");
    expect(ids).toContain("cookie-missing-httponly");
  });

  test("returns no accessibility findings for fully labeled form", () => {
    const report = analyzePassive({
      finalUrl: "https://example.com",
      headers: baseHeaders,
      html: goodHtml,
      initialUrl: "https://example.com",
      status: 200
    });

    const ids = report.findings.map((finding) => finding.id);
    expect(ids).not.toContain("missing-document-language");
    expect(ids).not.toContain("form-labels-missing");
    expect(ids).not.toContain("missing-h1");
    expect(ids).not.toContain("image-alt-missing");
  });
});

describe("hasUnlabeledFormControl", () => {
  test("ignores forms whose controls are aria-labeled", () => {
    const html = `<form><input type="text" aria-label="Email"></form>`;
    expect(hasUnlabeledFormControl(html)).toBe(false);
  });

  test("flags an unlabeled form even when an unrelated <label> exists elsewhere", () => {
    const html = `
      <label for="elsewhere">Other</label>
      <form><input type="email"></form>`;
    expect(hasUnlabeledFormControl(html)).toBe(true);
  });

  test("ignores hidden inputs", () => {
    const html = `<form><input type="hidden" name="csrf"></form>`;
    expect(hasUnlabeledFormControl(html)).toBe(false);
  });
});

describe("hasMetaCsp", () => {
  test("detects meta http-equiv CSP", () => {
    expect(
      hasMetaCsp(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`)
    ).toBe(true);
  });

  test("returns false without CSP meta", () => {
    expect(hasMetaCsp(`<meta name="viewport" content="width=device-width">`)).toBe(false);
  });
});

describe("setCookieValues", () => {
  test("returns array entries without re-splitting on commas inside Expires", () => {
    const cookies = setCookieValues({
      "set-cookie": [
        "session=abc; Path=/; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Secure",
        "csrf=xyz; Path=/"
      ]
    });

    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("Expires=Wed, 09 Jun 2027");
    expect(cookies[1]).toBe("csrf=xyz; Path=/");
  });
});
