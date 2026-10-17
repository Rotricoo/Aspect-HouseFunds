import { describe, expect, it } from "vitest";
import type { RecurringBill, RecurringContributionPlan } from "../types/recurring-bill";
import { parseDateOnly } from "../utils/date-only";
import { buildBillOccurrenceStatements, buildContributionOccurrenceStatements } from "./recurring-schedule-generator";

describe("recurring schedule generation", () => {
  it("generates a bounded weekly bill schedule", () => {
    const bill: RecurringBill = {
      id: "rent",
      name: "Rent",
      merchant: "Agent",
      category: "Rent",
      frequency: "weekly",
      defaultAmount: 830,
      defaultPaymentSourceId: "shared-bank",
      splitBetweenPersonIds: ["person-alex", "person-jordan", "person-sam"],
      preferredPaymentLeadDays: 3,
      startsOn: parseDateOnly("2026-10-02"),
      endsOn: parseDateOnly("2026-10-22"),
      isActive: true,
      notes: null,
    };
    const statements = buildBillOccurrenceStatements(bill, null);
    expect(statements).toHaveLength(3);
    expect(statements[0].values?.[2]).toBe("2026-10-02");
  });

  it("does not generate occurrences for an inactive plan", () => {
    const plan: RecurringContributionPlan = {
      id: "weekly",
      name: "Weekly",
      frequency: "weekly",
      amountPerPerson: 300,
      contributorPersonIds: ["person-alex", "person-jordan", "person-sam"],
      destinationFundSourceId: "shared-bank",
      startsOn: parseDateOnly("2026-10-05"),
      isActive: false,
      notes: null,
    };
    expect(buildContributionOccurrenceStatements(plan, "person-alex", null)).toEqual([]);
  });
});
