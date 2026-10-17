import { describe, expect, it } from "vitest";
import { createDemoData, DEMO_STORAGE_KEY, loadDemoData, saveDemoData } from "./demo-data";

describe("web demo data", () => {
  it("provides a self-contained fictional household workflow", () => {
    const data = createDemoData();
    const personIds = new Set(data.people.map((person) => person.id));
    const sourceIds = new Set(data.paymentSources.map((source) => source.id));
    const categoryIds = new Set(data.categories.map((category) => category.id));

    expect(data.people.length).toBeGreaterThan(0);
    expect(data.paymentSources.length).toBeGreaterThan(0);
    expect(data.settlementGroups.every((group) => group.memberPersonIds.every((id) => personIds.has(id)))).toBe(true);
    expect(data.purchases.every((purchase) => sourceIds.has(purchase.paymentSourceId))).toBe(true);
    expect(data.purchases.flatMap((purchase) => purchase.items).every((item) => categoryIds.has(item.categoryId ?? ""))).toBe(true);
  });

  it("restores persisted demo purchases as Date objects", () => {
    const data = createDemoData();
    saveDemoData(data);

    const restored = loadDemoData();

    expect(restored.purchases[0].date).toBeInstanceOf(Date);
    expect(restored.purchases[0].date.toISOString()).toContain("2026-01-15");
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  });
});
