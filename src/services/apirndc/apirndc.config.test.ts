import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getApiRndcBaseUrl, isApiRndcEnabled } from "./apirndc.config";

// Snapshot and restore env values set on import.meta.env
const envKeys = ["VITE_APIRNDC_ENABLED", "VITE_APIRNDC_BASE_URL"] as const;
type Key = typeof envKeys[number];

describe("apirndc.config", () => {
  const original: Record<Key, unknown> = {} as Record<Key, unknown>;

  beforeEach(() => {
    for (const k of envKeys) {
      original[k] = (import.meta.env as Record<string, unknown>)[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      (import.meta.env as Record<string, unknown>)[k] = original[k];
    }
  });

  describe("isApiRndcEnabled", () => {
    it('returns true only when flag is exactly "true"', () => {
      (import.meta.env as Record<string, unknown>).VITE_APIRNDC_ENABLED = "true";
      expect(isApiRndcEnabled()).toBe(true);
    });
    it("returns false for other values", () => {
      (import.meta.env as Record<string, unknown>).VITE_APIRNDC_ENABLED = "false";
      expect(isApiRndcEnabled()).toBe(false);

      (import.meta.env as Record<string, unknown>).VITE_APIRNDC_ENABLED = "1";
      expect(isApiRndcEnabled()).toBe(false);

      delete (import.meta.env as Record<string, unknown>).VITE_APIRNDC_ENABLED;
      expect(isApiRndcEnabled()).toBe(false);
    });
  });

  describe("getApiRndcBaseUrl", () => {
    it("uses default when env var not set", () => {
      delete (import.meta.env as Record<string, unknown>).VITE_APIRNDC_BASE_URL;
      expect(getApiRndcBaseUrl()).toBe("https://rndc.asegurar.com.co");
    });

    it("uses env var when set", () => {
      (import.meta.env as Record<string, unknown>).VITE_APIRNDC_BASE_URL = "https://api.example.com";
      expect(getApiRndcBaseUrl()).toBe("https://api.example.com");
    });

    it("strips trailing slashes", () => {
      (import.meta.env as Record<string, unknown>).VITE_APIRNDC_BASE_URL = "https://api.example.com///";
      expect(getApiRndcBaseUrl()).toBe("https://api.example.com");
    });

    it("strips trailing slash from default when needed", () => {
      (import.meta.env as Record<string, unknown>).VITE_APIRNDC_BASE_URL = "";
      // empty string is falsy, falls back to default
      expect(getApiRndcBaseUrl()).toBe("https://rndc.asegurar.com.co");
    });
  });
});
