import { describe, expect, it } from "vitest";
import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";
import { formatPersonNames, getPersonName, getSharedSourceLabel } from "./household-labels";

const people: Person[] = [
  { id: "person-one", name: "Alex", weeklyContribution: 0, isActive: true },
  { id: "person-two", name: "Jordan", weeklyContribution: 0, isActive: true },
];

const sources: PaymentSource[] = [
  { id: "shared-one", name: "Shared account", type: "bank-account", ownership: "household", managedBy: "household", openingBalance: null },
  {
    id: "personal-one",
    name: "Alex account",
    type: "bank-account",
    ownership: "person-one",
    managedBy: "person-one",
    openingBalance: null,
  },
];

describe("household labels", () => {
  it("resolves person IDs to names and keeps an understandable fallback", () => {
    expect(getPersonName("person-one", people)).toBe("Alex");
    expect(getPersonName("missing", people)).toBe("Unknown member");
  });

  it("formats multiple people for user-facing labels", () => {
    expect(formatPersonNames(["person-one", "person-two"], people)).toBe("Alex, Jordan");
    expect(formatPersonNames([], people)).toBe("No members selected");
  });

  it("uses configured shared source names with a neutral fallback", () => {
    expect(getSharedSourceLabel(sources)).toBe("Shared account");
    expect(getSharedSourceLabel([])).toBe("shared household sources");
  });
});
