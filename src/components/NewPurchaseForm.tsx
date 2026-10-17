import { useState, type FormEvent } from "react";
import { formatCurrency } from "../utils/formatters";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";
import type { Person } from "../types/person-id";
import {
  chooseAttachments,
  removeStoredAttachments,
  storeAttachments,
  type SelectedAttachment,
  type StoredAttachment,
} from "../services/attachment-service";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";
import { formatDateOnly, parseDateOnly } from "../utils/date-only";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { getPersonName } from "../utils/household-labels";

interface DraftPurchaseItem {
  id: string;
  name: string;
  description: string;
  quantityInput: string;
  unitPriceInput: string;
  category: string;
  ownership: "household" | "personal";
  ownerPersonIds: string[];
  splitBetweenPersonIds: string[];
  notes: string;
}

interface NewPurchaseFormProps {
  isClosing?: boolean;
  merchantOptions?: string[];
  onClose: () => void;
  onSubmit: (newPurchase: Purchase) => Promise<void>;
  purchaseToEdit?: Purchase;
  paymentSources: PaymentSource[];
  categories?: string[];
  people: Person[];
}

function createDraftItem(purchaseItem: Purchase["items"][number] | undefined, defaultPersonIds: string[]): DraftPurchaseItem {
  return {
    id: purchaseItem?.id ?? crypto.randomUUID(),
    name: purchaseItem?.name ?? "",
    description: purchaseItem?.description ?? "",
    quantityInput: String(purchaseItem?.quantity ?? 1),
    unitPriceInput: purchaseItem ? String(purchaseItem.unitPrice) : "",
    category: purchaseItem?.category ?? "General",
    ownership: purchaseItem?.ownership ?? "household",
    ownerPersonIds: purchaseItem?.ownerPersonIds ?? [],
    splitBetweenPersonIds: purchaseItem?.splitBetweenPersonIds ?? [...defaultPersonIds],
    notes: purchaseItem?.notes ?? "",
  };
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function NewPurchaseForm({
  isClosing = false,
  merchantOptions = [],
  onClose,
  onSubmit,
  purchaseToEdit,
  paymentSources,
  categories = [],
  people,
}: NewPurchaseFormProps) {
  const activePeople = people.filter((person) => person.isActive);
  const houseMemberIds = activePeople.map((person) => person.id);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const dialogRef = useDialogFocus<HTMLElement>();
  const isEditing = Boolean(purchaseToEdit);
  const [merchant, setMerchant] = useState(purchaseToEdit?.merchant ?? "");
  const [amountInput, setAmountInput] = useState(purchaseToEdit ? String(purchaseToEdit.receiptTotal) : "");
  const [dateInput, setDateInput] = useState(purchaseToEdit ? formatDateOnly(purchaseToEdit.date) : "");
  const [paymentSourceId, setPaymentSourceId] = useState(purchaseToEdit?.paymentSourceId ?? "");
  const [roundingAdjustmentInput, setRoundingAdjustmentInput] = useState(
    purchaseToEdit ? String(purchaseToEdit.receiptRoundingAdjustment) : "0",
  );
  const [notes, setNotes] = useState(purchaseToEdit?.notes ?? "");
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const [existingAttachmentPaths, setExistingAttachmentPaths] = useState<string[]>(purchaseToEdit?.attachmentPaths ?? []);
  const [draftItems, setDraftItems] = useState<DraftPurchaseItem[]>(
    purchaseToEdit
      ? purchaseToEdit.items.map((item) => createDraftItem(item, houseMemberIds))
      : [createDraftItem(undefined, houseMemberIds)],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [itemsAreConsolidated, setItemsAreConsolidated] = useState(purchaseToEdit?.itemsAreConsolidated ?? false);
  const [receiptItemCountInput, setReceiptItemCountInput] = useState(purchaseToEdit?.receiptItemCount?.toString() ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const itemsTotal = roundToCents(
    draftItems.reduce((total, item) => {
      return total + Number(item.quantityInput || 0) * Number(item.unitPriceInput || 0);
    }, 0),
  );
  const receiptTotal = Number(amountInput);
  const roundingAdjustment = Number(roundingAdjustmentInput);
  const receiptDifference = roundToCents(receiptTotal - (itemsTotal + roundingAdjustment));
  const canCheckReceipt = Number.isFinite(receiptTotal) && receiptTotal > 0 && Number.isFinite(roundingAdjustment);
  const isReceiptBalanced = canCheckReceipt && Math.abs(receiptDifference) < 0.01;

  function updateDraftItem(itemId: string, changes: Partial<DraftPurchaseItem>) {
    setDraftItems((previousItems) => previousItems.map((item) => (item.id === itemId ? { ...item, ...changes } : item)));
  }

  function togglePersonId(itemId: string, property: "ownerPersonIds" | "splitBetweenPersonIds", personId: string) {
    const item = draftItems.find((draftItem) => draftItem.id === itemId);

    if (!item) {
      return;
    }

    const personIds = item[property];
    const nextPersonIds = personIds.includes(personId) ? personIds.filter((id) => id !== personId) : [...personIds, personId];

    updateDraftItem(itemId, { [property]: nextPersonIds });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const normalizedMerchant = merchant.trim();
    const existingMerchant = merchantOptions.find((option) => option.toLowerCase() === normalizedMerchant.toLowerCase());

    if (!normalizedMerchant || !dateInput || !paymentSourceId) {
      setFormError("Complete the purchase information before adding it.");
      return;
    }

    if (!Number.isFinite(receiptTotal) || receiptTotal <= 0) {
      setFormError("Receipt total must be greater than zero.");
      return;
    }

    if (!Number.isFinite(roundingAdjustment)) {
      setFormError("Cash rounding must be a valid amount.");
      return;
    }

    const receiptItemCount = receiptItemCountInput.trim() === "" ? null : Number(receiptItemCountInput);

    if (receiptItemCount !== null && (!Number.isInteger(receiptItemCount) || receiptItemCount <= 0)) {
      setFormError("Receipt item count must be a positive whole number.");
      return;
    }

    if (itemsAreConsolidated && receiptItemCount === null) {
      setFormError("Enter the item count shown on the receipt.");
      return;
    }

    for (const item of draftItems) {
      const quantity = Number(item.quantityInput);
      const unitPrice = Number(item.unitPriceInput);

      if (!item.name.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        setFormError("Every item needs a name, quantity and valid unit price.");
        return;
      }

      if (item.splitBetweenPersonIds.length === 0) {
        setFormError("Choose at least one person to share every item.");
        return;
      }

      if (item.ownership === "personal" && item.ownerPersonIds.length === 0) {
        setFormError("Choose an owner for every personal item.");
        return;
      }
    }

    if (Math.abs(itemsTotal + roundingAdjustment - receiptTotal) >= 0.01) {
      setFormError(
        `Items total (${formatCurrency(itemsTotal)}) plus rounding (${formatCurrency(roundingAdjustment)}) must equal the receipt total (${formatCurrency(receiptTotal)}).`,
      );
      return;
    }

    const items = draftItems.map((item) => {
      const quantity = Number(item.quantityInput);
      const unitPrice = Number(item.unitPriceInput);

      return {
        id: item.id,
        name: item.name.trim(),
        description: item.description || item.name.trim(),
        quantity,
        unitPrice,
        totalAmount: roundToCents(quantity * unitPrice),
        category: item.category.trim() || "General",
        ownership: item.ownership,
        ownerPersonIds: item.ownership === "household" ? [] : item.ownerPersonIds,
        splitBetweenPersonIds: item.splitBetweenPersonIds,
        notes: item.notes.trim() || null,
      };
    });

    setIsSaving(true);
    let storedAttachments: StoredAttachment[] = [];
    try {
      storedAttachments = "__TAURI_INTERNALS__" in window ? await storeAttachments(selectedAttachments) : [];
      await onSubmit({
        id: purchaseToEdit?.id ?? crypto.randomUUID(),
        date: parseDateOnly(dateInput),
        merchant: existingMerchant ?? normalizedMerchant,
        receiptTotal: roundToCents(receiptTotal),
        paymentSourceId,
        items,
        receiptItemCount: receiptItemCount ?? items.reduce((total, item) => total + item.quantity, 0),
        itemsAreConsolidated,
        receiptRoundingAdjustment: roundToCents(roundingAdjustment),
        receiptRoundingSplitBetweenPersonIds:
          roundingAdjustment === 0
            ? []
            : purchaseToEdit?.receiptRoundingSplitBetweenPersonIds.length
              ? purchaseToEdit.receiptRoundingSplitBetweenPersonIds
              : [...houseMemberIds],
        attachmentPaths: [...existingAttachmentPaths, ...storedAttachments.map((attachment) => attachment.filePath)],
        notes: notes.trim() || null,
      });
    } catch (error) {
      await removeStoredAttachments(storedAttachments.map((attachment) => attachment.filePath));
      setFormError(error instanceof Error ? error.message : "The purchase could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const requestClose = useUnsavedChanges(hasUnsavedChanges, onClose, isSaving);

  return (
    <section
      ref={dialogRef}
      className={`new-purchase-form ${isClosing ? "new-purchase-form--closing" : ""}`}
      aria-modal="true"
      role="dialog"
    >
      <button className="new-purchase-form__close-icon" onClick={requestClose} type="button" aria-label="Close purchase form">
        <span aria-hidden="true">×</span>
      </button>
      <h2 className="new-purchase-form__title">{isEditing ? "Edit Purchase" : "New Purchase"}</h2>
      <form
        className="new-purchase-form__form"
        onSubmit={handleSubmit}
        onChange={() => setHasUnsavedChanges(true)}
        aria-describedby={formError ? "new-purchase-form-error" : undefined}
      >
        <datalist id="purchase-category-options">
          {categories.map((category) => (
            <option value={category} key={category} />
          ))}
        </datalist>
        <label className="new-purchase-form__label">
          Merchant:
          <input
            className="new-purchase-form__input"
            type="text"
            name="merchant"
            list="purchase-form-merchants"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            placeholder="Search or choose a previous merchant"
            required
          />
          <datalist id="purchase-form-merchants">
            {merchantOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <label className="new-purchase-form__label">
          Amount:
          <input
            className="new-purchase-form__input"
            type="number"
            name="amount"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required
          />
        </label>
        <label className="new-purchase-form__label">
          Date:
          <input
            className="new-purchase-form__input"
            type="date"
            name="date"
            value={dateInput}
            onChange={(event) => setDateInput(event.target.value)}
            required
          />
        </label>
        <label className="new-purchase-form__label">
          Payment Source:
          <select
            className="new-purchase-form__input"
            name="paymentSource"
            value={paymentSourceId}
            onChange={(event) => setPaymentSourceId(event.target.value)}
            required
          >
            <option value="">Select a payment source</option>
            {paymentSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label className="new-purchase-form__label">
          Cash rounding adjustment:
          <input
            className="new-purchase-form__input"
            type="number"
            name="roundingAdjustment"
            value={roundingAdjustmentInput}
            onChange={(event) => setRoundingAdjustmentInput(event.target.value)}
            step="0.01"
          />
        </label>
        <section className="new-purchase-form__items">
          <div className="new-purchase-form__items-heading">
            <h3>Receipt items</h3>
            <label>
              <input
                type="checkbox"
                checked={itemsAreConsolidated}
                onChange={(event) => {
                  setItemsAreConsolidated(event.target.checked);
                }}
              />
              Items entered as a consolidated record
            </label>
            <label>
              Receipt item count:
              <input
                type="number"
                min="1"
                step="1"
                value={receiptItemCountInput}
                onChange={(event) => setReceiptItemCountInput(event.target.value)}
                placeholder="Example: 21"
              />
            </label>
            <p>Items total: {formatCurrency(itemsTotal)}</p>
          </div>
          {draftItems.map((item, index) => (
            <fieldset className="new-purchase-form__item" key={item.id}>
              <legend>Item {index + 1}</legend>
              <label className="new-purchase-form__label">
                Item name:
                <input
                  className="new-purchase-form__input"
                  type="text"
                  value={item.name}
                  onChange={(event) => updateDraftItem(item.id, { name: event.target.value })}
                  placeholder="Product or service name"
                  required
                />
              </label>
              <label className="new-purchase-form__label">
                Quantity:
                <input
                  className="new-purchase-form__input"
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantityInput}
                  onChange={(event) => updateDraftItem(item.id, { quantityInput: event.target.value })}
                  required
                />
              </label>
              <label className="new-purchase-form__label">
                Unit price:
                <input
                  className="new-purchase-form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPriceInput}
                  onChange={(event) => updateDraftItem(item.id, { unitPriceInput: event.target.value })}
                  placeholder="0.00"
                  required
                />
              </label>
              <label className="new-purchase-form__label">
                Category:
                <input
                  list="purchase-category-options"
                  className="new-purchase-form__input"
                  type="text"
                  value={item.category}
                  onChange={(event) => updateDraftItem(item.id, { category: event.target.value })}
                  placeholder="Groceries, furniture, utilities..."
                />
              </label>
              <label className="new-purchase-form__label">
                Ownership:
                <select
                  className="new-purchase-form__input"
                  value={item.ownership}
                  onChange={(event) =>
                    updateDraftItem(item.id, {
                      ownership: event.target.value as DraftPurchaseItem["ownership"],
                    })
                  }
                >
                  <option value="household">Household</option>
                  <option value="personal">Personal</option>
                </select>
              </label>
              {item.ownership === "personal" && (
                <fieldset className="new-purchase-form__person-selection">
                  <legend>Owners</legend>
                  {houseMemberIds.map((personId) => (
                    <label key={personId}>
                      <input
                        type="checkbox"
                        checked={item.ownerPersonIds.includes(personId)}
                        onChange={() => togglePersonId(item.id, "ownerPersonIds", personId)}
                      />
                      {getPersonName(personId, people)}
                    </label>
                  ))}
                </fieldset>
              )}
              <fieldset className="new-purchase-form__person-selection">
                <legend>Shared by</legend>
                {houseMemberIds.map((personId) => (
                  <label key={personId}>
                    <input
                      type="checkbox"
                      checked={item.splitBetweenPersonIds.includes(personId)}
                      onChange={() => togglePersonId(item.id, "splitBetweenPersonIds", personId)}
                    />
                    {getPersonName(personId, people)}
                  </label>
                ))}
              </fieldset>
              <label className="new-purchase-form__label">
                Item notes:
                <input
                  className="new-purchase-form__input"
                  type="text"
                  value={item.notes}
                  onChange={(event) => updateDraftItem(item.id, { notes: event.target.value })}
                  placeholder="Optional details about this item"
                />
              </label>
              {draftItems.length > 1 && (
                <button
                  className="new-purchase-form__remove-item"
                  onClick={() => setDraftItems((previousItems) => previousItems.filter((draftItem) => draftItem.id !== item.id))}
                  type="button"
                >
                  Remove item
                </button>
              )}
            </fieldset>
          ))}
          <button
            className="new-purchase-form__add-item"
            onClick={() => setDraftItems((previousItems) => [...previousItems, createDraftItem(undefined, houseMemberIds)])}
            type="button"
          >
            Add another item
          </button>
        </section>
        <footer className="new-purchase-form__footer">
          <div className="new-purchase-form__footer-fields">
            <label className="new-purchase-form__label new-purchase-form__label--attachment">
              Receipt image or PDF
              <button
                className="new-purchase-form__input"
                type="button"
                onClick={async () => {
                  try {
                    const attachments = await chooseAttachments();
                    setSelectedAttachments((current) => [...current, ...attachments]);
                    if (attachments.length > 0) setHasUnsavedChanges(true);
                  } catch (error) {
                    setFormError(error instanceof Error ? error.message : "The attachments could not be selected.");
                  }
                }}
              >
                Choose receipt files
              </button>
              <small>Add a photo or PDF so the purchase can be audited later.</small>
            </label>
            <label className="new-purchase-form__label">
              Purchase notes
              <textarea
                className="new-purchase-form__input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context, warranty information or something to confirm later..."
              />
            </label>
          </div>

          {selectedAttachments.length > 0 && (
            <div className="new-purchase-form__attachment-status">
              Ready to attach:{" "}
              {selectedAttachments.map((file, index) => (
                <span key={`${file.sourcePath}-${index}`}>
                  {file.originalFileName}{" "}
                  <button
                    type="button"
                    onClick={() => setSelectedAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    Remove
                  </button>
                </span>
              ))}
            </div>
          )}
          {existingAttachmentPaths.length > 0 && (
            <div className="new-purchase-form__attachment-status">
              Already attached:{" "}
              {existingAttachmentPaths.map((filePath) => (
                <span key={filePath}>
                  {filePath.split("/").at(-1)}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setExistingAttachmentPaths((current) => current.filter((path) => path !== filePath));
                      setHasUnsavedChanges(true);
                    }}
                  >
                    Remove
                  </button>
                </span>
              ))}
            </div>
          )}

          {canCheckReceipt && (
            <div
              className={`new-purchase-form__receipt-check ${isReceiptBalanced ? "new-purchase-form__receipt-check--balanced" : "new-purchase-form__receipt-check--unbalanced"}`}
              aria-live="polite"
            >
              <strong>{isReceiptBalanced ? "Receipt balanced" : "Receipt does not balance"}</strong>
              <span>
                Items {formatCurrency(itemsTotal)} + rounding {formatCurrency(roundingAdjustment)} ={" "}
                {formatCurrency(itemsTotal + roundingAdjustment)}
              </span>
              {!isReceiptBalanced && <span>Difference from receipt: {formatCurrency(Math.abs(receiptDifference))}</span>}
            </div>
          )}

          {formError && (
            <p id="new-purchase-form-error" className="new-purchase-form__error" role="alert">
              {formError}
            </p>
          )}

          <div className="new-purchase-form__actions">
            <button className="new-purchase-form__cancel" onClick={requestClose} type="button">
              Cancel
            </button>
            <button className="new-purchase-form__submit" type="submit" disabled={isSaving || (canCheckReceipt && !isReceiptBalanced)}>
              {isSaving ? "Saving…" : isEditing ? "Save changes" : "Add Purchase"}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}

export default NewPurchaseForm;
