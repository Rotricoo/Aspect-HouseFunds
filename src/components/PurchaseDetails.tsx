import type { Purchase } from "../types/purchase";
import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";
import { formatCurrency, formatDate } from "../utils/formatters";
import { formatPersonNames } from "../utils/household-labels";
import { openStoredAttachment } from "../services/attachment-service";

interface PurchaseDetailsProps {
  purchase: Purchase;
  paymentSources: PaymentSource[];
  people: Person[];
  onClose: () => void;
  onEdit: () => void;
}

function PurchaseDetails({ purchase, paymentSources, people, onClose, onEdit }: PurchaseDetailsProps) {
  const paymentSource = paymentSources.find((source) => source.id === purchase.paymentSourceId);
  return (
    <section className="purchase-details">
      <button className="purchase-details__close-icon" onClick={onClose} type="button" aria-label="Close purchase details">
        <span aria-hidden="true">×</span>
      </button>
      <h2 className="purchase-details__title">Purchase Details</h2>
      <p className="purchase-details__merchant">Merchant: {purchase.merchant}</p>
      <p className="purchase-details__date">Date: {formatDate(purchase.date)}</p>
      {purchase.receiptItemCount !== null && (
        <p className="purchase-details__item-count">
          Receipt item count: {purchase.receiptItemCount}
          {purchase.itemsAreConsolidated ? " (entered as a consolidated record)" : ""}
        </p>
      )}
      <ul className="purchase-details__items">
        {purchase.items.map((item) => (
          <li key={item.id} className="purchase-details__item">
            <p className="purchase-details__item-description">
              {item.name} - Quantity: {item.quantity} - Price per unit: {formatCurrency(item.unitPrice)} - Total:{" "}
              {formatCurrency(item.totalAmount)}
            </p>
            <p className="purchase-details__item-shared-by">Shared by: {formatPersonNames(item.splitBetweenPersonIds, people)}</p>
            <p className="purchase-details__item-ownership">
              Ownership: {item.ownership === "household" ? "Household" : formatPersonNames(item.ownerPersonIds, people)}
            </p>
          </li>
        ))}
      </ul>
      {purchase.receiptRoundingAdjustment !== 0 && (
        <p className="purchase-details__rounding-adjustment">Receipt cash rounding: {formatCurrency(purchase.receiptRoundingAdjustment)}</p>
      )}
      <p className="purchase-details__payment-source">Paid from: {paymentSource?.name ?? "Information to be confirmed"}</p>
      <p className="purchase-details__total">Total: {formatCurrency(purchase.receiptTotal)}</p>
      <section className="purchase-details__attachments" aria-labelledby="purchase-attachments-title">
        <h3 id="purchase-attachments-title">Receipts and attachments</h3>
        {purchase.attachmentPaths.length === 0 ? (
          <p>No files attached.</p>
        ) : (
          <ul>
            {purchase.attachmentPaths.map((filePath) => (
              <li key={filePath}>
                <button type="button" onClick={() => void openStoredAttachment(filePath)}>
                  {filePath.split("/").at(-1)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button className="purchase-details__edit" onClick={onEdit} type="button">
        Edit Purchase
      </button>
      <button className="purchase-details__close" onClick={onClose} type="button">
        Close
      </button>
    </section>
  );
}

export default PurchaseDetails;
