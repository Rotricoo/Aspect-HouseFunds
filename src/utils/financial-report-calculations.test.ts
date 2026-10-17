import { describe, expect, it } from "vitest";
import type { PaymentInstallment } from "../types/payment-installment";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";
import type { Refund } from "../types/refund";
import type { SettlementGroup } from "../types/settlement-group";
import type { AfterpayPayment } from "../types/afterpay-payment";
import type { FundAdjustment } from "../types/fund-adjustment";
import { generateFinancialReport } from "./financial-report-calculations";
import { parseDateOnly } from "./date-only";

const paymentSources: PaymentSource[] = [
  { id: "shared-cash", name: "Shared Cash", type: "cash", ownership: "household", managedBy: "household", openingBalance: 0 },
  { id: "alex-bank", name: "Alex Bank", type: "bank-account", ownership: "person-alex", managedBy: "person-alex", openingBalance: null },
  {
    id: "jordan-bank",
    name: "Jordan Bank",
    type: "bank-account",
    ownership: "person-jordan",
    managedBy: "person-jordan",
    openingBalance: null,
  },
  { id: "sam-pay-later", name: "Sam Pay Later", type: "afterpay", ownership: "person-sam", managedBy: "person-sam", openingBalance: null },
];

const settlementGroups: SettlementGroup[] = [
  { id: "group-alex-jordan", name: "Alex & Jordan", memberPersonIds: ["person-alex", "person-jordan"] },
  { id: "group-sam", name: "Sam", memberPersonIds: ["person-sam"] },
];

function createPurchase(paymentSourceId: string, amount: number): Purchase {
  return {
    id: "purchase-1",
    date: new Date("2026-09-20"),
    merchant: "Test merchant",
    receiptTotal: amount,
    paymentSourceId,
    receiptItemCount: 1,
    receiptRoundingAdjustment: 0,
    receiptRoundingSplitBetweenPersonIds: [],
    attachmentPaths: [],
    notes: null,
    items: [
      {
        id: "item-1",
        name: "Shared item",
        description: "Test",
        quantity: 1,
        unitPrice: amount,
        totalAmount: amount,
        category: "Household",
        ownership: "household",
        ownerPersonIds: [],
        splitBetweenPersonIds: ["person-alex", "person-jordan", "person-sam"],
        notes: null,
      },
    ],
  };
}

function createReport(
  purchase: Purchase,
  refunds: Refund[] = [],
  paymentInstallments: PaymentInstallment[] = [],
  afterpayPayments: AfterpayPayment[] = [],
  adjustments: FundAdjustment[] = [],
  sources: PaymentSource[] = paymentSources,
) {
  return generateFinancialReport({
    purchases: [purchase],
    contributions: [],
    refunds,
    adjustments,
    balanceChecks: [],
    reimbursements: [],
    fundTransfers: [],
    paymentSources: sources,
    paymentInstallments,
    afterpayPayments,
    settlementGroups,
    asOfDate: new Date("2026-09-30"),
  });
}

describe("financial report", () => {
  it("includes purchases recorded later on the same calendar day", () => {
    const purchase = createPurchase("sam-pay-later", 90);
    purchase.date = parseDateOnly("2026-09-30");

    const report = createReport(purchase);

    expect(report.summary.grossPurchases).toBe(90);
    expect(report.summary.afterpayCommitted).toBe(90);
  });

  it("keeps archived members in historical calculations", () => {
    const report = generateFinancialReport({
      purchases: [createPurchase("alex-bank", 90)],
      contributions: [],
      refunds: [],
      adjustments: [],
      balanceChecks: [],
      reimbursements: [],
      fundTransfers: [],
      paymentSources,
      paymentInstallments: [],
      afterpayPayments: [],
      settlementGroups,
      personIds: ["person-alex", "person-jordan", "person-sam"],
      asOfDate: new Date("2026-09-30"),
    });

    expect(report.members.map((member) => member.personId)).toEqual(["person-alex", "person-jordan", "person-sam"]);
  });

  it("reports invalid source owners without crashing the financial report", () => {
    const invalidSources = paymentSources.map((source) =>
      source.id === "alex-bank" ? { ...source, ownership: "person-missing" } : source,
    );

    expect(() => createReport(createPurchase("alex-bank", 50), [], [], [], [], invalidSources)).not.toThrow();
    expect(createReport(createPurchase("alex-bank", 50), [], [], [], [], invalidSources).warnings).toContain(
      "Payment source alex-bank references unknown member person-missing.",
    );
  });

  it("creates balanced personal positions and a settlement", () => {
    const report = createReport(createPurchase("alex-bank", 90));

    expect(report.members.map(({ personId, immediatePosition }) => ({ personId, immediatePosition }))).toEqual([
      { personId: "person-alex", immediatePosition: 60 },
      { personId: "person-jordan", immediatePosition: -30 },
      { personId: "person-sam", immediatePosition: -30 },
    ]);
    expect(report.immediateSettlements).toEqual([
      { fromPersonId: "person-jordan", toPersonId: "person-alex", amount: 30 },
      { fromPersonId: "person-sam", toPersonId: "person-alex", amount: 30 },
    ]);
    expect(report.groupImmediateSettlements).toEqual([
      { fromGroupId: "group-sam", fromGroupName: "Sam", toGroupId: "group-alex-jordan", toGroupName: "Alex & Jordan", amount: 30 },
    ]);
  });

  it("records a personal bank payment without pretending to track the private bank balance", () => {
    const report = createReport(createPurchase("jordan-bank", 50));
    const jordanBank = report.sources.find((source) => source.sourceId === "jordan-bank");

    expect(jordanBank?.purchases).toBe(50);
    expect(jordanBank?.netMovement).toBe(-50);
    expect(jordanBank?.expectedBalance).toBeNull();
    expect(report.groupImmediateSettlements).toEqual([
      { fromGroupId: "group-sam", fromGroupName: "Sam", toGroupId: "group-alex-jordan", toGroupName: "Alex & Jordan", amount: 16.66 },
    ]);
  });

  it("applies a refund to the beneficiary and payment destination", () => {
    const refund: Refund = {
      id: "refund-1",
      date: new Date("2026-09-21"),
      merchant: "Test merchant",
      amount: 30,
      receivedToPaymentSourceId: "alex-bank",
      originalPurchaseId: "purchase-1",
      originalPurchaseItemId: "item-1",
      beneficiaryPersonIds: ["person-sam"],
      attachmentPaths: [],
      notes: null,
    };
    const report = createReport(createPurchase("alex-bank", 90), [refund]);

    expect(report.summary.netRecordedSpending).toBe(60);
    expect(report.members.find((member) => member.personId === "person-sam")?.totalResponsibility).toBe(0);
    expect(report.members.find((member) => member.personId === "person-alex")?.immediatePosition).toBe(30);
  });

  it("moves a paid Afterpay instalment from commitment to immediate positions", () => {
    const installment: PaymentInstallment = {
      id: "installment-1",
      purchaseId: "purchase-1",
      installmentNumber: 1,
      totalInstallments: 4,
      dueDate: new Date("2026-09-20"),
      paidDate: new Date("2026-09-20"),
      amount: 30,
      status: "paid",
      afterpaySourceId: "sam-pay-later",
      paidFromPaymentSourceId: "alex-bank",
      scheduleIsEstimated: false,
      notes: null,
    };
    const report = createReport(createPurchase("sam-pay-later", 120), [], [installment]);

    expect(report.summary.afterpayCommitted).toBe(90);
    expect(report.members.find((member) => member.personId === "person-alex")?.immediatePosition).toBe(20);
    expect(report.members.find((member) => member.personId === "person-sam")?.afterpayPosition).toBe(60);
    expect(report.members.reduce((total, member) => total + member.overallPosition, 0)).toBeCloseTo(0);
  });

  it("applies a confirmed Afterpay payment without requiring an exact instalment", () => {
    const payment: AfterpayPayment = {
      id: "afterpay-payment-1",
      afterpaySourceId: "sam-pay-later",
      date: new Date("2026-09-25"),
      amount: 30,
      paidFromPaymentSourceId: "alex-bank",
      notes: null,
    };
    const report = createReport(createPurchase("sam-pay-later", 120), [], [], [payment]);

    expect(report.summary.afterpayCommitted).toBe(90);
    expect(report.members.find((member) => member.personId === "person-alex")?.immediatePosition).toBe(20);
    expect(report.members.find((member) => member.personId === "person-sam")?.afterpayPosition).toBe(60);
    expect(report.members.reduce((total, member) => total + member.overallPosition, 0)).toBeCloseTo(0);
  });

  it("caps an Afterpay payment at the remaining commitment and reports the excess", () => {
    const payment: AfterpayPayment = {
      id: "afterpay-overpayment",
      afterpaySourceId: "sam-pay-later",
      date: new Date("2026-09-25"),
      amount: 150,
      paidFromPaymentSourceId: "alex-bank",
      notes: null,
    };
    const report = createReport(createPurchase("sam-pay-later", 120), [], [], [payment]);

    expect(report.summary.afterpayCommitted).toBe(0);
    expect(report.warnings).toContain("Afterpay payment afterpay-overpayment exceeds the remaining commitment by 30.");
    expect(report.members.reduce((total, member) => total + member.overallPosition, 0)).toBeCloseTo(0);
  });

  it("keeps balance-only adjustments out of member settlements", () => {
    const adjustment: FundAdjustment = {
      id: "count-correction",
      fundSourceId: "shared-cash",
      date: new Date("2026-09-21"),
      amount: 12,
      direction: "increase",
      reason: "cash-count-correction",
      allocationKind: "balance-only",
      splitBetweenPersonIds: [],
      notes: "Physical cash count correction",
      attachmentPaths: [],
    };
    const report = createReport(createPurchase("shared-cash", 90), [], [], [], [adjustment]);

    expect(report.sources.find((source) => source.sourceId === "shared-cash")?.adjustments).toBe(12);
    expect(report.members.map((member) => member.sharedFundResponsibility)).toEqual([30, 30, 30]);
    expect(report.warnings).not.toContain("Fund adjustments change source balances but are not allocated to individual members.");
  });

  it("allocates an unreceipted household expense without changing its source balance twice", () => {
    const adjustment: FundAdjustment = {
      id: "unreceipted-expense",
      fundSourceId: "shared-cash",
      date: new Date("2026-09-21"),
      amount: 30,
      direction: "decrease",
      reason: "other",
      allocationKind: "household-expense",
      splitBetweenPersonIds: ["person-alex", "person-jordan", "person-sam"],
      notes: "Household supplies without receipt",
      attachmentPaths: [],
    };
    const report = createReport(createPurchase("shared-cash", 90), [], [], [], [adjustment]);

    expect(report.sources.find((source) => source.sourceId === "shared-cash")?.adjustments).toBe(-30);
    expect(report.members.map((member) => member.sharedFundResponsibility)).toEqual([40, 40, 40]);
    expect(report.members.reduce((total, member) => total + member.sharedFundPosition, 0)).toBe(-120);
  });
});
