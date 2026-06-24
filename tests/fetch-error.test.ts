import { describe, expect, test } from "vitest";
import { describeFetchError } from "../netlify/functions/_lib/scan-engine";

function withCode(code: string, message = "") {
  const err = new Error(message) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe("describeFetchError", () => {
  test("DNS not found -> 400 with spelling hint", () => {
    const r = describeFetchError(withCode("ENOTFOUND", "getaddrinfo ENOTFOUND nope.example"));
    expect(r.status).toBe(400);
    expect(r.message).toMatch(/couldn't find that domain/i);
  });

  test("blocked/private host -> 400", () => {
    const r = describeFetchError(new Error("Only public URL targets can be scanned."));
    expect(r.status).toBe(400);
    expect(r.message).toMatch(/public/i);
  });

  test("timeout -> 504", () => {
    expect(describeFetchError(withCode("ETIMEDOUT")).status).toBe(504);
    expect(describeFetchError(new Error("Request timed out.")).status).toBe(504);
  });

  test("connection refused -> 502", () => {
    expect(describeFetchError(withCode("ECONNREFUSED")).status).toBe(502);
  });

  test("TLS/cert problem -> 502 with cert wording", () => {
    const r = describeFetchError(withCode("CERT_HAS_EXPIRED"));
    expect(r.status).toBe(502);
    expect(r.message).toMatch(/certificate/i);
  });

  test("too many redirects -> 400", () => {
    expect(describeFetchError(new Error("Too many redirects.")).status).toBe(400);
  });

  test("unknown error -> 502 generic", () => {
    const r = describeFetchError(new Error("something weird"));
    expect(r.status).toBe(502);
    expect(r.message).toMatch(/couldn't reach/i);
  });
});
