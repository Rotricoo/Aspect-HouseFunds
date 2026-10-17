import { useEffect, useState } from "react";
import { loadFinancialMovementData } from "../database/financial-data-repository";
import { loadAllPurchases, loadRecurringData } from "../database/recurring-bill-repository";
import { loadReferenceData } from "../database/reference-data-repository";
import type { AfterpayPayment } from "../types/afterpay-payment";
import type { Category } from "../types/category";
import type { FinancialMovementCancellation } from "../types/financial-movement";
import type { FundAdjustment } from "../types/fund-adjustment";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundContribution } from "../types/fund-contribution";
import type { FundTransfer } from "../types/fund-transfer";
import type { PaymentInstallment } from "../types/payment-installment";
import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";
import type { Purchase } from "../types/purchase";
import type {
  RecurringBill,
  RecurringBillOccurrence,
  RecurringContributionOccurrence,
  RecurringContributionPlan,
} from "../types/recurring-bill";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";
import type { SettlementGroup } from "../types/settlement-group";
import { loadDemoData, saveDemoData } from "../demo/demo-data";

export function useHouseFundData() {
  const isWebDemo = !("__TAURI_INTERNALS__" in window);
  const [demoData] = useState(() => (isWebDemo ? loadDemoData() : null));
  const [purchases, setPurchases] = useState<Purchase[]>(() => demoData?.purchases ?? []);
  const [fundContributions, setFundContributions] = useState<FundContribution[]>([]);
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallment[]>([]);
  const [afterpayPayments, setAfterpayPayments] = useState<AfterpayPayment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [fundTransfers, setFundTransfers] = useState<FundTransfer[]>([]);
  const [balanceChecks, setBalanceChecks] = useState<FundBalanceCheck[]>([]);
  const [fundAdjustments, setFundAdjustments] = useState<FundAdjustment[]>([]);
  const [movementCancellations, setMovementCancellations] = useState<FinancialMovementCancellation[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [recurringBillOccurrences, setRecurringBillOccurrences] = useState<RecurringBillOccurrence[]>([]);
  const [recurringContributionPlans, setRecurringContributionPlans] = useState<RecurringContributionPlan[]>([]);
  const [recurringContributionOccurrences, setRecurringContributionOccurrences] = useState<RecurringContributionOccurrence[]>([]);
  const [availablePaymentSources, setAvailablePaymentSources] = useState<PaymentSource[]>(() => demoData?.paymentSources ?? []);
  const [people, setPeople] = useState<Person[]>(() => demoData?.people ?? []);
  const [settlementGroups, setSettlementGroups] = useState<SettlementGroup[]>(() => demoData?.settlementGroups ?? []);
  const [categories, setCategories] = useState<Category[]>(() => demoData?.categories ?? []);
  const [isDatabaseLoading, setIsDatabaseLoading] = useState("__TAURI_INTERNALS__" in window);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  async function refreshRecurringData() {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const recurringData = await loadRecurringData();
    setRecurringBills(recurringData.bills);
    setRecurringBillOccurrences(recurringData.occurrences);
    setRecurringContributionPlans(recurringData.contributionPlans);
    setRecurringContributionOccurrences(recurringData.contributionOccurrences);
  }

  async function refreshFinancialData() {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const financialData = await loadFinancialMovementData();
    setFundContributions(financialData.contributions);
    setRefunds(financialData.refunds);
    setReimbursements(financialData.reimbursements);
    setFundTransfers(financialData.transfers);
    setBalanceChecks(financialData.balanceChecks);
    setFundAdjustments(financialData.adjustments);
    setPaymentInstallments(financialData.installments);
    setAfterpayPayments(financialData.afterpayPayments);
    setMovementCancellations(financialData.cancellations);
  }

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let isCancelled = false;
    Promise.all([loadRecurringData(), loadAllPurchases(), loadFinancialMovementData(), loadReferenceData()])
      .then(([recurringData, databasePurchases, financialData, referenceData]) => {
        if (isCancelled) return;
        setRecurringBills(recurringData.bills);
        setRecurringBillOccurrences(recurringData.occurrences);
        setRecurringContributionPlans(recurringData.contributionPlans);
        setRecurringContributionOccurrences(recurringData.contributionOccurrences);
        setPurchases(databasePurchases);
        setFundContributions(financialData.contributions);
        setRefunds(financialData.refunds);
        setReimbursements(financialData.reimbursements);
        setFundTransfers(financialData.transfers);
        setBalanceChecks(financialData.balanceChecks);
        setFundAdjustments(financialData.adjustments);
        setPaymentInstallments(financialData.installments);
        setAfterpayPayments(financialData.afterpayPayments);
        setMovementCancellations(financialData.cancellations);
        setAvailablePaymentSources(referenceData.paymentSources);
        setPeople(referenceData.people);
        setSettlementGroups(referenceData.settlementGroups);
        setCategories(referenceData.categories);
        setDatabaseError(null);
      })
      .catch((error) => {
        console.error("HouseFund data could not be loaded from SQLite.", error);
        if (!isCancelled) setDatabaseError(error instanceof Error ? error.message : "The database could not be loaded.");
      })
      .finally(() => {
        if (!isCancelled) setIsDatabaseLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isWebDemo) return;
    saveDemoData({ people, paymentSources: availablePaymentSources, settlementGroups, categories, purchases });
  }, [availablePaymentSources, categories, isWebDemo, people, purchases, settlementGroups]);

  return {
    purchases,
    setPurchases,
    fundContributions,
    setFundContributions,
    paymentInstallments,
    setPaymentInstallments,
    afterpayPayments,
    setAfterpayPayments,
    refunds,
    setRefunds,
    reimbursements,
    setReimbursements,
    fundTransfers,
    setFundTransfers,
    balanceChecks,
    setBalanceChecks,
    fundAdjustments,
    setFundAdjustments,
    movementCancellations,
    setMovementCancellations,
    recurringBills,
    setRecurringBills,
    recurringBillOccurrences,
    setRecurringBillOccurrences,
    recurringContributionPlans,
    recurringContributionOccurrences,
    setRecurringContributionOccurrences,
    availablePaymentSources,
    setAvailablePaymentSources,
    people,
    setPeople,
    setSettlementGroups,
    settlementGroups,
    categories,
    setCategories,
    isDatabaseLoading,
    databaseError,
    refreshRecurringData,
    refreshFinancialData,
  };
}
