import { describe, expect, test } from "vitest";
import { __testables } from "../netlify/functions/_lib/network";

const { isPrivateIpv4, isPrivateIpv6, isPrivateIpAddress } = __testables;

describe("isPrivateIpv4", () => {
  test("blocks loopback, RFC1918, link-local, CGNAT, and reserved ranges", () => {
    expect(isPrivateIpv4("127.0.0.1")).toBe(true);
    expect(isPrivateIpv4("10.20.30.40")).toBe(true);
    expect(isPrivateIpv4("192.168.1.1")).toBe(true);
    expect(isPrivateIpv4("172.16.0.1")).toBe(true);
    expect(isPrivateIpv4("172.31.255.255")).toBe(true);
    expect(isPrivateIpv4("169.254.1.1")).toBe(true);
    expect(isPrivateIpv4("100.64.0.1")).toBe(true);
    expect(isPrivateIpv4("224.0.0.1")).toBe(true);
    expect(isPrivateIpv4("239.255.255.255")).toBe(true);
    expect(isPrivateIpv4("0.0.0.0")).toBe(true);
  });

  test("does not block legitimate public ranges", () => {
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
    expect(isPrivateIpv4("172.32.0.1")).toBe(false);
    expect(isPrivateIpv4("198.52.100.1")).toBe(false);
    expect(isPrivateIpv4("203.0.114.1")).toBe(false);
    expect(isPrivateIpv4("100.128.0.1")).toBe(false);
  });
});

describe("isPrivateIpv6", () => {
  test("blocks all loopback and reserved forms regardless of compression", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("0:0:0:0:0:0:0:1")).toBe(true);
    expect(isPrivateIpv6("0::1")).toBe(true);
    expect(isPrivateIpv6("::")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
    expect(isPrivateIpv6("fc00::1")).toBe(true);
    expect(isPrivateIpv6("fd12::abcd")).toBe(true);
    expect(isPrivateIpv6("ff02::1")).toBe(true);
    expect(isPrivateIpv6("2001:db8::1")).toBe(true);
  });

  test("blocks ipv4-mapped private addresses in both compact and expanded forms", () => {
    expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIpv6("::ffff:7f00:1")).toBe(true);
    expect(isPrivateIpv6("::ffff:10.0.0.1")).toBe(true);
  });

  test("does not block legitimate public IPv6 addresses", () => {
    expect(isPrivateIpv6("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateIpv6("2001:4860:4860::8888")).toBe(false);
  });
});

describe("isPrivateIpAddress", () => {
  test("supports IPv6 addresses with brackets", () => {
    expect(isPrivateIpAddress("[::1]")).toBe(true);
    expect(isPrivateIpAddress("[fe80::1]")).toBe(true);
    expect(isPrivateIpAddress("[2606:4700:4700::1111]")).toBe(false);
  });

  test("returns false for hostnames", () => {
    expect(isPrivateIpAddress("example.com")).toBe(false);
  });
});
