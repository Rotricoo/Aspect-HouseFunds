import type { Purchase } from "../types/purchase";
import { formatCurrency, formatDate } from "../utils/formatters";

interface PurchaseListItemProps {
  purchase: Purchase;
  onPurchaseSelect: (purchase: Purchase) => void;
}

function PurchaseListItem({ purchase, onPurchaseSelect }: PurchaseListItemProps) {
  return (
    <li className="purchase-list__item">
      <button className="purchase-list__item-button" type="button" onClick={() => onPurchaseSelect(purchase)}>
        <span className="purchase-list__item-merchant">{purchase.merchant} </span>
        <span className="purchase-list__item-total">{formatCurrency(purchase.receiptTotal)} </span>
        <span className="purchase-list__item-date"> {formatDate(purchase.date)} </span>
      </button>
    </li>
  );
}

export default PurchaseListItem;
