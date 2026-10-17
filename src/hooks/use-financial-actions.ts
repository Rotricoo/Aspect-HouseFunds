import type { Dispatch, SetStateAction } from "react";
import { deleteCategory, saveCategory } from "../database/reference-data-repository";
import {
  deleteAfterpayPayment,
  deleteFinancialMovement,
  saveAfterpayPayment,
  saveFundAdjustment,
  saveFundBalanceCheck,
  saveFundContribution,
  saveFundTransfer,
  saveRefund,
  saveReimbursement,
  setFinancialMovementCancellation,
} from "../database/financial-data-repository";
import type { AfterpayPayment } from "../types/afterpay-payment";
import type { Category } from "../types/category";
import type { FundAdjustment } from "../types/fund-adjustment";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundContribution } from "../types/fund-contribution";
import type { FundTransfer } from "../types/fund-transfer";
import type { FinancialMovementCancellation, FinancialMovementType } from "../types/financial-movement";
import type { RecurringContributionOccurrence, RecurringContributionPlan } from "../types/recurring-bill";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";

type Persist = (operation: () => Promise<void>, message?: string) => Promise<void>;

interface FinancialActionState {
  fundContributions: FundContribution[];
  setFundContributions: Dispatch<SetStateAction<FundContribution[]>>;
  recurringContributionPlans: RecurringContributionPlan[];
  recurringContributionOccurrences: RecurringContributionOccurrence[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
  setAfterpayPayments: Dispatch<SetStateAction<AfterpayPayment[]>>;
  setRefunds: Dispatch<SetStateAction<Refund[]>>;
  setReimbursements: Dispatch<SetStateAction<Reimbursement[]>>;
  setFundTransfers: Dispatch<SetStateAction<FundTransfer[]>>;
  setBalanceChecks: Dispatch<SetStateAction<FundBalanceCheck[]>>;
  setFundAdjustments: Dispatch<SetStateAction<FundAdjustment[]>>;
  setMovementCancellations: Dispatch<SetStateAction<FinancialMovementCancellation[]>>;
  persist: Persist;
}

export function useFinancialActions(state: FinancialActionState) {
  async function saveContribution(value: FundContribution) {
    const matchingPlan = state.recurringContributionPlans.find(
      (plan) =>
        plan.isActive &&
        plan.destinationFundSourceId === value.fundSourceId &&
        plan.contributorPersonIds.includes(value.contributorPersonId) &&
        Math.abs(plan.amountPerPerson - value.amount) < 0.01,
    );
    const matchingOccurrence = matchingPlan
      ? state.recurringContributionOccurrences.find((occurrence) => {
          const distanceInDays = value.date
            ? Math.abs(occurrence.dueDate.getTime() - value.date.getTime()) / 86_400_000
            : Number.POSITIVE_INFINITY;
          return (
            occurrence.recurringContributionPlanId === matchingPlan.id &&
            occurrence.personId === value.contributorPersonId &&
            ["scheduled", "overdue"].includes(occurrence.status) &&
            distanceInDays <= 3
          );
        })
      : undefined;
    if (!state.fundContributions.some((item) => item.id === value.id) && matchingOccurrence) {
      throw new Error(
        `This matches the weekly ${matchingPlan!.name} schedule. Open Bills & Contributions and mark that scheduled contribution as paid instead.`,
      );
    }
    await state.persist(() => saveFundContribution(value), "Saving contribution");
    state.setFundContributions((current) => [...current.filter((item) => item.id !== value.id), value]);
  }

  async function saveCategoryEntry(value: Category) {
    await state.persist(() => saveCategory(value), "Saving category");
    state.setCategories((current) =>
      [...current.filter((item) => item.id !== value.id), value].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function deleteCategoryEntry(value: Category) {
    await state.persist(() => deleteCategory(value), "Deleting category");
    state.setCategories((current) => current.filter((item) => item.id !== value.id));
  }

  async function saveAfterpay(value: AfterpayPayment) {
    await state.persist(() => saveAfterpayPayment(value), "Saving Afterpay payment");
    state.setAfterpayPayments((current) => [...current.filter((item) => item.id !== value.id), value]);
  }

  async function deleteAfterpay(value: AfterpayPayment) {
    await state.persist(() => deleteAfterpayPayment(value.id), "Deleting Afterpay payment");
    state.setAfterpayPayments((current) => current.filter((item) => item.id !== value.id));
  }

  async function saveRefundEntry(value: Refund) {
    await state.persist(() => saveRefund(value), "Saving refund");
    state.setRefunds((current) => [...current.filter((item) => item.id !== value.id), value]);
  }

  async function saveReimbursementEntry(value: Reimbursement, settlementPeriodId?: string) {
    await state.persist(() => saveReimbursement(value, settlementPeriodId), "Saving reimbursement");
    state.setReimbursements((current) => [...current.filter((item) => item.id !== value.id), value]);
  }

  async function saveTransfer(value: FundTransfer) {
    await state.persist(() => saveFundTransfer(value), "Saving transfer");
    state.setFundTransfers((current) => [...current.filter((item) => item.id !== value.id), value]);
  }

  async function saveBalanceCheck(value: FundBalanceCheck) {
    await state.persist(() => saveFundBalanceCheck(value), "Saving balance check");
    state.setBalanceChecks((current) => [...current.filter((item) => item.id !== value.id), value]);
  }

  async function saveAdjustment(value: FundAdjustment) {
    await state.persist(() => saveFundAdjustment(value), "Saving adjustment");
    state.setFundAdjustments((current) => [...current.filter((item) => item.id !== value.id), value]);
  }

  async function changeCancellation(type: FinancialMovementType, id: string, reason: string | null) {
    await state.persist(
      () => setFinancialMovementCancellation(type, id, reason),
      reason === null ? "Reactivating movement" : "Cancelling movement",
    );
    state.setMovementCancellations((current) =>
      reason === null
        ? current.filter((item) => !(item.entityType === type && item.entityId === id))
        : [
            ...current.filter((item) => !(item.entityType === type && item.entityId === id)),
            { entityType: type, entityId: id, cancelledAt: new Date(), reason },
          ],
    );
  }

  async function deleteMovement(type: FinancialMovementType, id: string) {
    await state.persist(() => deleteFinancialMovement(type, id), "Deleting movement");
    if (type === "contribution") state.setFundContributions((current) => current.filter((item) => item.id !== id));
    if (type === "refund") state.setRefunds((current) => current.filter((item) => item.id !== id));
    if (type === "reimbursement") state.setReimbursements((current) => current.filter((item) => item.id !== id));
    if (type === "transfer") state.setFundTransfers((current) => current.filter((item) => item.id !== id));
    if (type === "balance-check") state.setBalanceChecks((current) => current.filter((item) => item.id !== id));
    if (type === "adjustment") state.setFundAdjustments((current) => current.filter((item) => item.id !== id));
    state.setMovementCancellations((current) => current.filter((item) => !(item.entityType === type && item.entityId === id)));
  }

  return {
    handleContributionSave: saveContribution,
    handleCategorySave: saveCategoryEntry,
    handleCategoryDelete: deleteCategoryEntry,
    handleAfterpayPaymentSave: saveAfterpay,
    handleAfterpayPaymentDelete: deleteAfterpay,
    handleRefundSave: saveRefundEntry,
    handleReimbursementSave: saveReimbursementEntry,
    handleTransferSave: saveTransfer,
    handleBalanceCheckSave: saveBalanceCheck,
    handleAdjustmentSave: saveAdjustment,
    handleMovementCancellationChange: changeCancellation,
    handleMovementDelete: deleteMovement,
  };
}
