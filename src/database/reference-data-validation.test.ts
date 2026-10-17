import { describe, expect, it } from "vitest";
import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";
import type { SettlementGroup } from "../types/settlement-group";
import { validateCategory, validatePaymentSource, validatePerson, validateSettlementGroup } from "./reference-data-validation";

const person: Person = { id: "person-one", name: "Alex", weeklyContribution: 25, isActive: true };
const source: PaymentSource = {
  id: "shared-one",
  name: "Shared account",
  type: "bank-account",
  ownership: "household",
  managedBy: "household",
  openingBalance: null,
};
const group: SettlementGroup = { id: "group-one", name: "Household", memberPersonIds: [person.id] };

describe("reference data validation", () => {
  it("accepts valid member data", () => expect(() => validatePerson(person)).not.toThrow());
  it("rejects blank member names and negative contributions", () => {
    expect(() => validatePerson({ ...person, name: " " })).toThrow("Member name is required.");
    expect(() => validatePerson({ ...person, weeklyContribution: -1 })).toThrow("zero or greater");
  });
  it("rejects household pay-later sources", () => {
    expect(() => validatePaymentSource({ ...source, type: "afterpay" })).toThrow("must belong to a member");
  });
  it("requires named payment sources and non-negative balances", () => {
    expect(() => validatePaymentSource({ ...source, name: " " })).toThrow("Payment source name is required.");
    expect(() => validatePaymentSource({ ...source, openingBalance: -1 })).toThrow("zero or greater");
  });
  it("requires unique members in settlement groups", () => {
    expect(() => validateSettlementGroup(group)).not.toThrow();
    expect(() => validateSettlementGroup({ ...group, memberPersonIds: [] })).toThrow("at least one member");
    expect(() => validateSettlementGroup({ ...group, memberPersonIds: [person.id, person.id] })).toThrow("twice");
  });
  it("requires named categories", () => {
    expect(() => validateCategory({ id: "category-one", name: "Groceries", isActive: true })).not.toThrow();
    expect(() => validateCategory({ id: "category-one", name: " ", isActive: true })).toThrow("Category name is required.");
  });
});
