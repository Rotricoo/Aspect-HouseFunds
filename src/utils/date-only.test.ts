import { describe, expect, it } from "vitest";
import { formatDateOnly, monthDateRange } from "./date-only";

describe("monthDateRange", () => {
  it("returns the complete calendar month", () => {
    const range = monthDateRange("2026-09");
    expect(formatDateOnly(range.start)).toBe("2026-09-01");
    expect(formatDateOnly(range.end)).toBe("2026-09-30");
  });

  it("handles leap years", () => {
    expect(formatDateOnly(monthDateRange("2028-02").end)).toBe("2028-02-29");
  });
});
