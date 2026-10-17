import { useMemo, useState } from "react";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";

export type PurchasePeriodFilter = "all" | "week" | "fortnight" | "month";
export type PurchaseSortOrder = "newest" | "oldest";

interface PurchaseFiltersProps {
  purchases: Purchase[];
  paymentSources: PaymentSource[];
  period: PurchasePeriodFilter;
  merchant: string;
  startDate: string;
  endDate: string;
  paymentSourceId: string;
  sortOrder: PurchaseSortOrder;
  matchedCount: number;
  visibleCount: number;
  onPeriodChange: (period: PurchasePeriodFilter) => void;
  onMerchantChange: (merchant: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onPaymentSourceChange: (paymentSourceId: string) => void;
  onSortOrderChange: (sortOrder: PurchaseSortOrder) => void;
  onClear: () => void;
}

const periodOptions: { label: string; value: PurchasePeriodFilter }[] = [
  { label: "All", value: "all" },
  { label: "7 days", value: "week" },
  { label: "Fortnight", value: "fortnight" },
  { label: "Month", value: "month" },
];

function PurchaseFilters({
  purchases,
  paymentSources,
  period,
  merchant,
  startDate,
  endDate,
  paymentSourceId,
  sortOrder,
  matchedCount,
  visibleCount,
  onPeriodChange,
  onMerchantChange,
  onStartDateChange,
  onEndDateChange,
  onPaymentSourceChange,
  onSortOrderChange,
  onClear,
}: PurchaseFiltersProps) {
  const hasAdvancedFilters = Boolean(merchant || startDate || endDate || paymentSourceId);
  const [areAdvancedFiltersOpen, setAreAdvancedFiltersOpen] = useState(hasAdvancedFilters);

  const merchantOptions = useMemo(
    () => [...new Set(purchases.map((purchase) => purchase.merchant))].sort((first, second) => first.localeCompare(second)),
    [purchases],
  );

  const isDateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);
  const activeFilterCount = [period !== "all", merchant, startDate, endDate, paymentSourceId].filter(Boolean).length;

  function handleRangeChange(type: "start" | "end", value: string) {
    onPeriodChange("all");
    if (type === "start") {
      onStartDateChange(value);
    } else {
      onEndDateChange(value);
    }
  }

  return (
    <section className="purchase-filters" aria-label="Purchase filters">
      <div className="purchase-filters__toolbar">
        <div className="purchase-filters__periods" aria-label="Filter purchases by period">
          {periodOptions.map((option) => (
            <button
              className={`purchase-filters__period ${period === option.value ? "purchase-filters__period--active" : ""}`}
              key={option.value}
              onClick={() => {
                onStartDateChange("");
                onEndDateChange("");
                onPeriodChange(option.value);
              }}
              type="button"
              aria-pressed={period === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          className={`purchase-filters__toggle ${areAdvancedFiltersOpen ? "purchase-filters__toggle--active" : ""}`}
          onClick={() => setAreAdvancedFiltersOpen((isOpen) => !isOpen)}
          type="button"
          aria-expanded={areAdvancedFiltersOpen}
          aria-controls="advanced-purchase-filters"
        >
          <span aria-hidden="true">⌁</span>
          More filters
          {activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
        </button>

        <label className="purchase-filters__sort">
          <span className="purchase-filters__sort-label">Order</span>
          <select
            className="purchase-filters__sort-select"
            value={sortOrder}
            onChange={(event) => onSortOrderChange(event.target.value as PurchaseSortOrder)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>

        <p className="purchase-filters__result-count" aria-live="polite">
          Showing {visibleCount} of {matchedCount}
          {matchedCount !== purchases.length ? ` matched (${purchases.length} total)` : ""}
        </p>
      </div>

      <div
        className={`purchase-filters__advanced ${areAdvancedFiltersOpen ? "purchase-filters__advanced--open" : ""}`}
        id="advanced-purchase-filters"
        hidden={!areAdvancedFiltersOpen}
      >
        <label className="purchase-filters__field">
          <span>Merchant</span>
          <input
            className="purchase-filters__input"
            type="search"
            list="purchase-filter-merchants"
            value={merchant}
            onChange={(event) => onMerchantChange(event.target.value)}
            placeholder="Search or choose a merchant"
          />
          <datalist id="purchase-filter-merchants">
            {merchantOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <label className="purchase-filters__field">
          <span>Start date</span>
          <input
            className="purchase-filters__input"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => handleRangeChange("start", event.target.value)}
          />
        </label>

        <label className="purchase-filters__field">
          <span>End date</span>
          <input
            className="purchase-filters__input"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => handleRangeChange("end", event.target.value)}
          />
        </label>

        <label className="purchase-filters__field">
          <span>Payment source</span>
          <select
            className="purchase-filters__input"
            value={paymentSourceId}
            onChange={(event) => onPaymentSourceChange(event.target.value)}
          >
            <option value="">All payment sources</option>
            {paymentSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>

        <button className="purchase-filters__clear" onClick={onClear} type="button" disabled={activeFilterCount === 0}>
          Clear filters
        </button>

        {isDateRangeInvalid && <p className="purchase-filters__error">Start date must be before the end date.</p>}
      </div>
    </section>
  );
}

export default PurchaseFilters;
