import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { trustedSiteUrl } from "../netlify/functions/_lib/site-url";

const original: Record<string, string | undefined> = {};
const keys = ["URL", "SITE_URL", "NODE_ENV", "NETLIFY_CONTEXT", "NETLIFY_DEV"];

beforeEach(() => {
  for (const key of keys) {
    original[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

describe("trustedSiteUrl", () => {
  test("returns the configured https origin", () => {
    process.env.URL = "https://app.example.com/";
    expect(trustedSiteUrl()).toBe("https://app.example.com");
  });

  test("falls back to localhost when no env is set in non-production", () => {
    process.env.NODE_ENV = "test";
    expect(trustedSiteUrl()).toBe("http://localhost:8888");
  });

  test("throws in production when URL env is missing", () => {
    process.env.NODE_ENV = "production";
    expect(() => trustedSiteUrl()).toThrow(/URL or SITE_URL must be set/);
  });

  test("throws in production when URL is plain http", () => {
    process.env.NODE_ENV = "production";
    process.env.URL = "http://app.example.com";
    expect(() => trustedSiteUrl()).toThrow(/https/);
  });

  test("accepts http://localhost in non-production", () => {
    process.env.NODE_ENV = "development";
    process.env.URL = "http://localhost:8888";
    expect(trustedSiteUrl()).toBe("http://localhost:8888");
  });
});
