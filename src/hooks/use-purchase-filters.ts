import { useEffect, useMemo, useState } from "react";
import type { PurchasePeriodFilter, PurchaseSortOrder } from "../components/PurchaseFilters";
import type { Purchase } from "../types/purchase";
import { formatDateOnly } from "../utils/date-only";

const defaultPageSize = 15;

interface PurchaseFilterValues {
  period: PurchasePeriodFilter;
  merchant: string;
  startDate: string;
  endDate: string;
  paymentSourceId: string;
  sortOrder: PurchaseSortOrder;
}

interface FilterPurchasesInput extends PurchaseFilterValues {
  purchases: Purchase[];
  today: Date;
}

function getPeriodStartDate(period: PurchasePeriodFilter, today: Date): Date | null {
  if (period === "all") return null;

  const numberOfDays = { week: 7, fortnight: 15, month: 30 }[period];
  const startDate = new Date(today);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (numberOfDays - 1));
  return startDate;
}

export function filterAndSortPurchases({
  purchases,
  period,
  merchant,
  startDate,
  endDate,
  paymentSourceId,
  sortOrder,
  today,
}: FilterPurchasesInput): Purchase[] {
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const periodStartDate = getPeriodStartDate(period, today);
  const normalizedMerchant = merchant.trim().toLowerCase();

  return purchases
    .filter((purchase) => {
      const purchaseDate = formatDateOnly(purchase.date);
      return (
        (!normalizedMerchant || purchase.merchant.toLowerCase().includes(normalizedMerchant)) &&
        (!startDate || purchaseDate >= startDate) &&
        (!endDate || purchaseDate <= endDate) &&
        (!paymentSourceId || purchase.paymentSourceId === paymentSourceId) &&
        (!periodStartDate || (purchase.date >= periodStartDate && purchase.date <= endOfToday))
      );
    })
    .sort((firstPurchase, secondPurchase) => {
      const dateDifference = firstPurchase.date.getTime() - secondPurchase.date.getTime();
      if (dateDifference !== 0) return sortOrder === "oldest" ? dateDifference : -dateDifference;
      return firstPurchase.merchant.localeCompare(secondPurchase.merchant) || firstPurchase.id.localeCompare(secondPurchase.id);
    });
}

export function usePurchaseFilters(purchases: Purchase[], pageSize = defaultPageSize) {
  const [period, setPeriod] = useState<PurchasePeriodFilter>("all");
  const [merchant, setMerchant] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [sortOrder, setSortOrder] = useState<PurchaseSortOrder>("newest");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const merchantOptions = useMemo(
    () => [...new Set(purchases.map((purchase) => purchase.merchant))].sort((first, second) => first.localeCompare(second)),
    [purchases],
  );
  const filteredPurchases = useMemo(
    () =>
      filterAndSortPurchases({
        purchases,
        period,
        merchant,
        startDate,
        endDate,
        paymentSourceId,
        sortOrder,
        today: new Date(),
      }),
    [endDate, merchant, paymentSourceId, period, purchases, sortOrder, startDate],
  );
  const visiblePurchases = filteredPurchases.slice(0, visibleCount);

  useEffect(() => setVisibleCount(pageSize), [endDate, merchant, pageSize, paymentSourceId, period, sortOrder, startDate]);

  function clear() {
    setPeriod("all");
    setMerchant("");
    setStartDate("");
    setEndDate("");
    setPaymentSourceId("");
  }

  function loadMore() {
    setVisibleCount((currentCount) => currentCount + pageSize);
  }

  return {
    period,
    setPeriod,
    merchant,
    setMerchant,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    paymentSourceId,
    setPaymentSourceId,
    sortOrder,
    setSortOrder,
    merchantOptions,
    filteredPurchases,
    visiblePurchases,
    clear,
    loadMore,
  };
}
