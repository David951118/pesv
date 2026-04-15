import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn (classname merger)", () => {
  it("joins multiple classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditional falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("merges conflicting tailwind classes — later wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("merges conflicting color classes", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("accepts object and array inputs (clsx semantics)", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
