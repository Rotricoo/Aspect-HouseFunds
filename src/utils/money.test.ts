import { describe, expect, it } from "vitest";
import { addMoney, subtractMoney, sumMoney, toMoneyCents } from "./money";

describe("integer-cent money operations", () => {
  it("adds decimal inputs without floating-point drift", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(toMoneyCents(addMoney(13.07, 13.07, 13.06))).toBe(3920);
  });

  it("subtracts and aggregates in cents", () => {
    expect(subtractMoney(2500, 357, 1156.99)).toBe(986.01);
    expect(sumMoney([{ amount: 5.55 }, { amount: 4.45 }], (entry) => entry.amount)).toBe(10);
  });
});
