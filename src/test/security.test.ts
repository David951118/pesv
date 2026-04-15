/**
 * Security regression tests.
 *
 * These tests verify that critical security controls are in place.
 * They run against the codebase (static analysis) and config files,
 * not against a live environment.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

// ---------- P0: Credentials exposure ----------

describe("P0 - Credential exposure", () => {
  it("SEC-02: .gitignore must exclude .env files", () => {
    const gitignore = readFile(".gitignore");
    expect(gitignore).toContain(".env");
  });
});

// ---------- P1: Self-registration disabled ----------

describe("P1 - Self-registration disabled", () => {
  it("SEC-15: Auth page must not have register tab/form", () => {
    const auth = readFile("src/pages/Auth.tsx");
    expect(auth).not.toContain("Registrarse");
    expect(auth).not.toContain("Crear Cuenta");
    expect(auth).not.toContain('handleAuth("register")');
    expect(auth).not.toContain("signUp");
  });
});

// ---------- P2: CSP headers ----------

describe("P2 - Security headers", () => {
  it("SEC-18: index.html must have Content-Security-Policy", () => {
    const html = readFile("index.html");
    expect(html).toContain("Content-Security-Policy");
  });

  it("SEC-19: vercel.json must set X-Frame-Options DENY via HTTP header", () => {
    const vercel = readFile("vercel.json");
    expect(vercel).toContain("X-Frame-Options");
    expect(vercel).toContain("DENY");
  });

  it("SEC-20: index.html must have X-Content-Type-Options", () => {
    const html = readFile("index.html");
    expect(html).toContain("X-Content-Type-Options");
    expect(html).toContain("nosniff");
  });
});

// ---------- P1: No Supabase remnants ----------

describe("P1 - No Supabase client in source", () => {
  it("SEC-40: no source file imports supabase client", () => {
    const client = resolve(ROOT, "src/integrations/supabase/client.ts");
    expect(() => readFileSync(client)).toThrow();
  });
});
