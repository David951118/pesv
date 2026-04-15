import { describe, it, expect } from "vitest";
import { API_ROLE_MAP, mapApiRolesToAppRole } from "./useAuth";

describe("API_ROLE_MAP", () => {
  it("maps ROLE_ADMIN to admin with highest priority", () => {
    expect(API_ROLE_MAP.ROLE_ADMIN.appRole).toBe("admin");
    expect(API_ROLE_MAP.ROLE_ADMIN.priority).toBe(3);
  });
  it("maps ROLE_CLIENTE_ADMIN to supervisor", () => {
    expect(API_ROLE_MAP.ROLE_CLIENTE_ADMIN.appRole).toBe("supervisor");
  });
  it("maps ROLE_CLIENTE and ROLE_USER to conductor", () => {
    expect(API_ROLE_MAP.ROLE_CLIENTE.appRole).toBe("conductor");
    expect(API_ROLE_MAP.ROLE_USER.appRole).toBe("conductor");
  });
});

describe("mapApiRolesToAppRole", () => {
  it("returns 'conductor' when empty", () => {
    expect(mapApiRolesToAppRole([])).toBe("conductor");
  });

  it("returns 'conductor' when none match (default fallback)", () => {
    expect(mapApiRolesToAppRole(["ROLE_UNKNOWN"])).toBe("conductor");
  });

  it("returns admin when ROLE_ADMIN present", () => {
    expect(mapApiRolesToAppRole(["ROLE_ADMIN"])).toBe("admin");
  });

  it("picks highest priority when multiple provided", () => {
    expect(mapApiRolesToAppRole(["ROLE_USER", "ROLE_CLIENTE_ADMIN", "ROLE_CLIENTE"])).toBe("supervisor");
    expect(mapApiRolesToAppRole(["ROLE_USER", "ROLE_CLIENTE_ADMIN", "ROLE_ADMIN"])).toBe("admin");
  });

  it("maps single ROLE_CLIENTE to conductor", () => {
    expect(mapApiRolesToAppRole(["ROLE_CLIENTE"])).toBe("conductor");
  });

  it("ignores unknown roles but still maps known ones", () => {
    expect(mapApiRolesToAppRole(["ROLE_UNKNOWN", "ROLE_ADMIN"])).toBe("admin");
  });
});
