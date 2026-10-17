import type { Purchase } from "../types/purchase";
import PurchaseListItem from "./PurchaseListItem";

interface PurchaseListProps {
  purchases: Purchase[];
  totalCount?: number;
  hasActiveFilters?: boolean;
  onPurchaseSelect: (purchase: Purchase) => void;
  onScrollPositionChange?: (scrollTop: number) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onCreatePurchase?: () => void;
  onClearFilters?: () => void;
}

function PurchaseList({
  purchases,
  totalCount = purchases.length,
  hasActiveFilters = false,
  onPurchaseSelect,
  onScrollPositionChange,
  hasMore,
  onLoadMore,
  onCreatePurchase,
  onClearFilters,
}: PurchaseListProps) {
  if (purchases.length === 0) {
    return (
      <div className="purchase-list__empty-state">
        <strong>{totalCount === 0 ? "No purchases yet" : "No purchases match these filters"}</strong>
        <span>
          {totalCount === 0
            ? "Record your first household purchase to start seeing shared responsibility and settlement insights."
            : "Clear or adjust the filters to see more household activity."}
        </span>
        {totalCount === 0 && onCreatePurchase && (
          <button type="button" onClick={onCreatePurchase}>
            Record first purchase
          </button>
        )}
        {totalCount > 0 && hasActiveFilters && onClearFilters && (
          <button type="button" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="purchase-list" onScroll={(event) => onScrollPositionChange?.(event.currentTarget.scrollTop)}>
      {purchases.map((purchase) => (
        <PurchaseListItem key={purchase.id} purchase={purchase} onPurchaseSelect={onPurchaseSelect} />
      ))}
      {hasMore && (
        <li className="purchase-list__load-more-item">
          <button className="purchase-list__load-more" type="button" onClick={onLoadMore}>
            Load 15 more
          </button>
        </li>
      )}
    </ul>
  );
}

export default PurchaseList;
