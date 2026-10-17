import type { Dispatch, SetStateAction } from "react";
import {
  createPurchaseFromRecurringOccurrence,
  deleteRecurringBill,
  deleteRecurringContributionPlan,
  saveRecurringBill,
  saveRecurringContributionOccurrence,
  saveRecurringContributionPlan,
  saveRecurringOccurrence,
} from "../database/recurring-bill-repository";
import type { StoredAttachment } from "../services/attachment-service";
import type { Purchase } from "../types/purchase";
import type {
  RecurringBill,
  RecurringBillOccurrence,
  RecurringContributionOccurrence,
  RecurringContributionPlan,
} from "../types/recurring-bill";

interface UseRecurringActionsOptions {
  setPurchases: Dispatch<SetStateAction<Purchase[]>>;
  setRecurringBills: Dispatch<SetStateAction<RecurringBill[]>>;
  setRecurringBillOccurrences: Dispatch<SetStateAction<RecurringBillOccurrence[]>>;
  setRecurringContributionOccurrences: Dispatch<SetStateAction<RecurringContributionOccurrence[]>>;
  refreshRecurringData: () => Promise<void>;
  refreshFinancialData: () => Promise<void>;
  persist: <T>(message: string, operation: () => Promise<T>) => Promise<T>;
}

export function useRecurringActions({
  setPurchases,
  setRecurringBills,
  setRecurringBillOccurrences,
  setRecurringContributionOccurrences,
  refreshRecurringData,
  refreshFinancialData,
  persist,
}: UseRecurringActionsOptions) {
  async function handleRecurringBillOccurrenceSave(
    bill: RecurringBill,
    occurrence: RecurringBillOccurrence,
    attachments: StoredAttachment[],
  ) {
    const result =
      "__TAURI_INTERNALS__" in window
        ? await persist("Saving recurring payment", () => saveRecurringOccurrence({ bill, occurrence, attachments }))
        : {
            occurrence: { ...occurrence, purchaseId: occurrence.status === "paid" ? (occurrence.purchaseId ?? occurrence.id) : null },
            purchase: occurrence.status === "paid" ? createPurchaseFromRecurringOccurrence(bill, occurrence) : null,
            removedPurchaseId: occurrence.status === "paid" ? null : occurrence.purchaseId,
          };

    setRecurringBillOccurrences((current) =>
      current.map((currentOccurrence) => (currentOccurrence.id === result.occurrence.id ? result.occurrence : currentOccurrence)),
    );
    if (result.purchase) {
      setPurchases((current) => {
        const purchaseExists = current.some((purchase) => purchase.id === result.purchase!.id);
        return purchaseExists
          ? current.map((purchase) => (purchase.id === result.purchase!.id ? result.purchase! : purchase))
          : [...current, result.purchase!];
      });
    }
    if (result.removedPurchaseId) {
      setPurchases((current) => current.filter((purchase) => purchase.id !== result.removedPurchaseId));
    }
  }

  async function handleRecurringContributionOccurrenceSave(occurrence: RecurringContributionOccurrence, plan: RecurringContributionPlan) {
    const saved =
      "__TAURI_INTERNALS__" in window
        ? await persist("Saving weekly contribution", () => saveRecurringContributionOccurrence(occurrence, plan))
        : occurrence;
    setRecurringContributionOccurrences((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    if ("__TAURI_INTERNALS__" in window) await refreshFinancialData();
  }

  async function handleRecurringContributionPlanSave(plan: RecurringContributionPlan, effectiveFrom: Date) {
    if ("__TAURI_INTERNALS__" in window) {
      await persist("Saving contribution plan", () => saveRecurringContributionPlan(plan, effectiveFrom));
      await refreshRecurringData();
    }
  }

  async function handleRecurringContributionPlanDelete(plan: RecurringContributionPlan) {
    if (!window.confirm(`Delete contribution plan "${plan.name}"?`)) return;
    if ("__TAURI_INTERNALS__" in window) {
      await persist("Deleting contribution plan", () => deleteRecurringContributionPlan(plan.id));
      await refreshRecurringData();
    }
  }

  async function handleRecurringBillSave(bill: RecurringBill, effectiveFrom: Date) {
    if ("__TAURI_INTERNALS__" in window) {
      await persist("Saving recurring bill", () => saveRecurringBill(bill, effectiveFrom));
      await refreshRecurringData();
    } else {
      setRecurringBills((current) => [...current.filter((item) => item.id !== bill.id), bill]);
    }
  }

  async function handleRecurringBillDelete(bill: RecurringBill) {
    if ("__TAURI_INTERNALS__" in window) await persist("Deleting recurring bill", () => deleteRecurringBill(bill.id));
    setRecurringBills((current) => current.filter((item) => item.id !== bill.id));
  }

  return {
    handleRecurringBillOccurrenceSave,
    handleRecurringContributionOccurrenceSave,
    handleRecurringContributionPlanSave,
    handleRecurringContributionPlanDelete,
    handleRecurringBillSave,
    handleRecurringBillDelete,
  };
}
