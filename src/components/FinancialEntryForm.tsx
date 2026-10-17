import { useState, type FormEvent } from "react";
import type { FundAdjustment } from "../types/fund-adjustment";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundTransfer } from "../types/fund-transfer";
import type { PaymentSource } from "../types/payment-source";
import type { Person, PersonId } from "../types/person-id";
import type { Purchase } from "../types/purchase";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";
import { parseDateOnly, todayDateOnly } from "../utils/date-only";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";
import type { EditableFinancialMovement } from "../types/financial-movement";
import { formatDateOnly } from "../utils/date-only";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { chooseAttachments, removeStoredAttachments, storeAttachments, type SelectedAttachment } from "../services/attachment-service";
import RefundEntryFields from "./financial-entry-form/RefundEntryFields";
import ReimbursementEntryFields from "./financial-entry-form/ReimbursementEntryFields";
import TransferEntryFields from "./financial-entry-form/TransferEntryFields";
import FundAdjustmentFields from "./financial-entry-form/FundAdjustmentFields";

type FinancialEntryType = "refund" | "reimbursement" | "transfer" | "balance-check" | "adjustment";

interface FinancialEntryFormProps {
  purchases: Purchase[];
  onClose: () => void;
  onRefundAdd: (refund: Refund) => Promise<void>;
  onReimbursementAdd: (reimbursement: Reimbursement) => Promise<void>;
  onTransferAdd: (transfer: FundTransfer) => Promise<void>;
  onBalanceCheckAdd: (balanceCheck: FundBalanceCheck) => Promise<void>;
  onAdjustmentAdd: (adjustment: FundAdjustment) => Promise<void>;
  paymentSources: PaymentSource[];
  entryToEdit?: Exclude<EditableFinancialMovement, { type: "contribution" }>;
  reimbursementDraft?: Reimbursement;
  people: Person[];
}

function getTodayInputValue(): string {
  return todayDateOnly();
}

function createLocalDate(value: string): Date {
  return parseDateOnly(value);
}

function FinancialEntryForm({
  purchases,
  onClose,
  onRefundAdd,
  onReimbursementAdd,
  onTransferAdd,
  onBalanceCheckAdd,
  onAdjustmentAdd,
  paymentSources,
  entryToEdit,
  reimbursementDraft,
  people,
}: FinancialEntryFormProps) {
  const reimbursement = entryToEdit?.type === "reimbursement" ? entryToEdit.value : reimbursementDraft;
  const householdSources = paymentSources.filter((source) => source.ownership === "household");
  const activePeople = people.filter((person) => person.isActive);
  const defaultHouseholdSourceId = householdSources.find((source) => source.type === "cash")?.id ?? householdSources[0]?.id ?? "";
  const defaultFromPersonId = reimbursement?.fromPersonId ?? activePeople[0]?.id ?? "";
  const defaultToPersonId = reimbursement?.toPersonId ?? activePeople.find((person) => person.id !== defaultFromPersonId)?.id ?? "";
  const defaultPersonalSourceId =
    paymentSources.find((source) => source.ownership === defaultFromPersonId && source.type === "bank-account")?.id ??
    paymentSources.find((source) => source.ownership === defaultFromPersonId && source.type !== "afterpay")?.id ??
    "";
  const initialValue = entryToEdit?.value ?? reimbursementDraft;
  const initialDate = initialValue && ("checkedAt" in initialValue ? initialValue.checkedAt : initialValue.date);
  const [entryType, setEntryType] = useState<FinancialEntryType>(entryToEdit?.type ?? (reimbursementDraft ? "reimbursement" : "refund"));
  const [dateInput, setDateInput] = useState(initialDate ? formatDateOnly(initialDate) : getTodayInputValue());
  const [amountInput, setAmountInput] = useState(
    initialValue ? String("countedAmount" in initialValue ? initialValue.countedAmount : initialValue.amount) : "",
  );
  const [notes, setNotes] = useState(initialValue?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus<HTMLElement>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const attachmentEntry = entryToEdit?.type === "refund" || entryToEdit?.type === "adjustment" ? entryToEdit.value : undefined;
  const [existingAttachmentPaths, setExistingAttachmentPaths] = useState<string[]>(attachmentEntry?.attachmentPaths ?? []);
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);

  const refund = entryToEdit?.type === "refund" ? entryToEdit.value : undefined;
  const transfer = entryToEdit?.type === "transfer" ? entryToEdit.value : undefined;
  const balanceCheck = entryToEdit?.type === "balance-check" ? entryToEdit.value : undefined;
  const adjustment = entryToEdit?.type === "adjustment" ? entryToEdit.value : undefined;
  const [merchant, setMerchant] = useState(refund?.merchant ?? "");
  const [originalPurchaseId, setOriginalPurchaseId] = useState(refund?.originalPurchaseId ?? "");
  const [originalPurchaseItemId, setOriginalPurchaseItemId] = useState(refund?.originalPurchaseItemId ?? "");
  const [beneficiaryPersonIds, setBeneficiaryPersonIds] = useState<PersonId[]>(
    (refund?.beneficiaryPersonIds as PersonId[] | undefined) ?? [],
  );
  const [receivedToPaymentSourceId, setReceivedToPaymentSourceId] = useState(refund?.receivedToPaymentSourceId ?? defaultHouseholdSourceId);

  const [fromPersonId, setFromPersonId] = useState<PersonId>(defaultFromPersonId);
  const [toPersonId, setToPersonId] = useState<PersonId>(defaultToPersonId);
  const [reimbursementPaymentSourceId, setReimbursementPaymentSourceId] = useState(
    reimbursement?.paymentSourceId ?? defaultPersonalSourceId,
  );
  const [appliesTo, setAppliesTo] = useState<Reimbursement["appliesTo"]>(reimbursement?.appliesTo ?? "immediate");
  const [relatedPurchaseId, setRelatedPurchaseId] = useState(reimbursement?.relatedPurchaseIds[0] ?? "");

  const [fromPaymentSourceId, setFromPaymentSourceId] = useState(transfer?.fromPaymentSourceId ?? householdSources[0]?.id ?? "");
  const [toPaymentSourceId, setToPaymentSourceId] = useState(
    transfer?.toPaymentSourceId ?? householdSources[1]?.id ?? householdSources[0]?.id ?? "",
  );

  const [fundSourceId, setFundSourceId] = useState(balanceCheck?.fundSourceId ?? adjustment?.fundSourceId ?? defaultHouseholdSourceId);
  const [adjustmentDirection, setAdjustmentDirection] = useState<FundAdjustment["direction"]>(adjustment?.direction ?? "decrease");
  const [adjustmentReason, setAdjustmentReason] = useState<FundAdjustment["reason"]>(adjustment?.reason ?? "cash-count-correction");
  const [adjustmentAllocationKind, setAdjustmentAllocationKind] = useState<FundAdjustment["allocationKind"]>(
    adjustment?.allocationKind ?? "balance-only",
  );
  const [adjustmentSplitPersonIds, setAdjustmentSplitPersonIds] = useState<PersonId[]>(
    adjustment?.splitBetweenPersonIds ?? people.filter((person) => person.isActive).map((person) => person.id),
  );

  function toggleBeneficiary(personId: PersonId) {
    setBeneficiaryPersonIds((current) =>
      current.includes(personId) ? current.filter((currentPersonId) => currentPersonId !== personId) : [...current, personId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const amount = Number(amountInput);
    const amountIsInvalid = !Number.isFinite(amount) || (entryType === "balance-check" ? amount < 0 : amount <= 0);
    if (!dateInput || amountIsInvalid) {
      setError(
        entryType === "balance-check"
          ? "Choose a date and enter a balance of zero or more."
          : "Choose a date and enter an amount greater than zero.",
      );
      return;
    }

    const roundedAmount = Math.round(amount * 100) / 100;
    const date = createLocalDate(dateInput);
    const commonNotes = notes.trim() || null;

    if (entryType === "refund") {
      if (!merchant.trim() || !originalPurchaseId || beneficiaryPersonIds.length === 0) {
        setError("A refund needs a merchant, original purchase and at least one beneficiary.");
        return;
      }
      const storedAttachments =
        "__TAURI_INTERNALS__" in window && selectedAttachments.length > 0 ? await storeAttachments(selectedAttachments) : [];
      await save(
        () =>
          onRefundAdd({
            id: refund?.id ?? crypto.randomUUID(),
            date,
            merchant: merchant.trim(),
            amount: roundedAmount,
            receivedToPaymentSourceId,
            originalPurchaseId,
            originalPurchaseItemId: originalPurchaseItemId || null,
            beneficiaryPersonIds,
            attachmentPaths: [...existingAttachmentPaths, ...storedAttachments.map((attachment) => attachment.filePath)],
            notes: commonNotes,
          }),
        storedAttachments.map((attachment) => attachment.filePath),
      );
      return;
    }

    if (entryType === "reimbursement") {
      if (fromPersonId === toPersonId) {
        setError("A reimbursement must move between two different people.");
        return;
      }
      await save(() =>
        onReimbursementAdd({
          id: reimbursement?.id ?? crypto.randomUUID(),
          date,
          fromPersonId,
          toPersonId,
          amount: roundedAmount,
          paymentSourceId: reimbursementPaymentSourceId,
          appliesTo,
          relatedPurchaseIds: relatedPurchaseId ? [relatedPurchaseId] : [],
          notes: commonNotes,
        }),
      );
      return;
    }

    if (entryType === "transfer") {
      if (fromPaymentSourceId === toPaymentSourceId) {
        setError("Choose two different funds for a transfer.");
        return;
      }
      await save(() =>
        onTransferAdd({
          id: transfer?.id ?? crypto.randomUUID(),
          date,
          fromPaymentSourceId,
          toPaymentSourceId,
          amount: roundedAmount,
          notes: commonNotes,
        }),
      );
      return;
    }

    if (entryType === "balance-check") {
      await save(() =>
        onBalanceCheckAdd({
          id: balanceCheck?.id ?? crypto.randomUUID(),
          fundSourceId,
          countedAmount: roundedAmount,
          checkedAt: date,
          notes: commonNotes,
        }),
      );
      return;
    }

    const storedAttachments =
      "__TAURI_INTERNALS__" in window && selectedAttachments.length > 0 ? await storeAttachments(selectedAttachments) : [];
    if (adjustmentAllocationKind === "household-expense" && adjustmentSplitPersonIds.length === 0) {
      setError("Choose at least one person for an allocated household expense.");
      return;
    }
    await save(
      () =>
        onAdjustmentAdd({
          id: adjustment?.id ?? crypto.randomUUID(),
          fundSourceId,
          date,
          amount: roundedAmount,
          direction: adjustmentDirection,
          reason: adjustmentReason,
          allocationKind: adjustmentAllocationKind,
          splitBetweenPersonIds: adjustmentAllocationKind === "household-expense" ? adjustmentSplitPersonIds : [],
          notes: notes.trim() || "Manual fund adjustment",
          attachmentPaths: [...existingAttachmentPaths, ...storedAttachments.map((attachment) => attachment.filePath)],
        }),
      storedAttachments.map((attachment) => attachment.filePath),
    );
  }

  async function save(operation: () => Promise<void>, newlyStoredPaths: string[] = []) {
    setIsSaving(true);
    try {
      await operation();
    } catch (saveError) {
      await removeStoredAttachments(newlyStoredPaths);
      setError(saveError instanceof Error ? saveError.message : "This financial event could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const requestClose = useUnsavedChanges(hasUnsavedChanges, onClose, isSaving);

  return (
    <section ref={dialogRef} className="financial-entry-form" role="dialog" aria-modal="true" aria-labelledby="financial-entry-form-title">
      <button className="financial-entry-form__close" onClick={requestClose} type="button" aria-label="Close financial event form">
        ×
      </button>
      <header className="financial-entry-form__header">
        <p>Financial engine entry</p>
        <h2 id="financial-entry-form-title">
          {entryToEdit ? "Edit financial event" : reimbursementDraft ? "Record settlement payment" : "Record financial event"}
        </h2>
        <span>Choose what happened. The form will show only the information required for that event.</span>
      </header>

      <form
        className="financial-entry-form__form"
        onSubmit={handleSubmit}
        onChange={() => setHasUnsavedChanges(true)}
        aria-describedby={error ? "financial-entry-form-error" : undefined}
      >
        <label className="financial-entry-form__field financial-entry-form__field--wide">
          <span>Event type</span>
          <select
            value={entryType}
            disabled={Boolean(entryToEdit || reimbursementDraft)}
            onChange={(event) => {
              setEntryType(event.target.value as FinancialEntryType);
              setError(null);
            }}
          >
            <option value="refund">Refund received</option>
            <option value="reimbursement">Reimbursement between people</option>
            <option value="transfer">Transfer between household funds</option>
            <option value="balance-check">Physical balance check</option>
            <option value="adjustment">Fund balance adjustment</option>
          </select>
        </label>

        <label className="financial-entry-form__field">
          <span>Date</span>
          <input type="date" value={dateInput} onChange={(event) => setDateInput(event.target.value)} required />
        </label>
        <label className="financial-entry-form__field">
          <span>{entryType === "balance-check" ? "Counted balance" : "Amount"}</span>
          <input
            type="number"
            min={entryType === "balance-check" ? "0" : "0.01"}
            step="0.01"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        {entryType === "refund" && (
          <RefundEntryFields
            purchases={purchases}
            paymentSources={paymentSources}
            merchant={merchant}
            originalPurchaseId={originalPurchaseId}
            originalPurchaseItemId={originalPurchaseItemId}
            beneficiaryPersonIds={beneficiaryPersonIds}
            receivedToPaymentSourceId={receivedToPaymentSourceId}
            onMerchantChange={setMerchant}
            onPurchaseChange={(value) => {
              setOriginalPurchaseId(value);
              setOriginalPurchaseItemId("");
            }}
            onItemChange={setOriginalPurchaseItemId}
            onRefundSourceChange={setReceivedToPaymentSourceId}
            onBeneficiaryToggle={toggleBeneficiary}
            people={people}
          />
        )}

        {entryType === "reimbursement" && (
          <ReimbursementEntryFields
            purchases={purchases}
            paymentSources={paymentSources}
            fromPersonId={fromPersonId}
            toPersonId={toPersonId}
            paymentSourceId={reimbursementPaymentSourceId}
            appliesTo={appliesTo}
            relatedPurchaseId={relatedPurchaseId}
            onFromPersonChange={(personId) => {
              setFromPersonId(personId);
              setReimbursementPaymentSourceId(
                paymentSources.find((source) => source.ownership === personId && source.type === "bank-account")?.id ??
                  paymentSources.find((source) => source.ownership === personId && source.type !== "afterpay")?.id ??
                  "",
              );
            }}
            onToPersonChange={setToPersonId}
            onPaymentSourceChange={setReimbursementPaymentSourceId}
            onAppliesToChange={setAppliesTo}
            onRelatedPurchaseChange={setRelatedPurchaseId}
            people={people}
          />
        )}

        {entryType === "transfer" && (
          <TransferEntryFields
            householdSources={householdSources}
            fromPaymentSourceId={fromPaymentSourceId}
            toPaymentSourceId={toPaymentSourceId}
            onFromChange={setFromPaymentSourceId}
            onToChange={setToPaymentSourceId}
          />
        )}

        {(entryType === "balance-check" || entryType === "adjustment") && (
          <FundAdjustmentFields
            entryType={entryType}
            householdSources={householdSources}
            fundSourceId={fundSourceId}
            adjustmentDirection={adjustmentDirection}
            adjustmentReason={adjustmentReason}
            adjustmentAllocationKind={adjustmentAllocationKind}
            adjustmentSplitPersonIds={adjustmentSplitPersonIds}
            onFundSourceChange={setFundSourceId}
            onDirectionChange={setAdjustmentDirection}
            onReasonChange={setAdjustmentReason}
            onAllocationKindChange={setAdjustmentAllocationKind}
            onSplitToggle={(personId) =>
              setAdjustmentSplitPersonIds((current) =>
                current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
              )
            }
            people={people}
          />
        )}

        {(entryType === "refund" || entryType === "adjustment") && (
          <div className="financial-entry-form__field financial-entry-form__field--wide">
            <span>Receipt or proof</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  const attachments = await chooseAttachments();
                  setSelectedAttachments((current) => [...current, ...attachments]);
                  if (attachments.length > 0) setHasUnsavedChanges(true);
                } catch (attachmentError) {
                  setError(attachmentError instanceof Error ? attachmentError.message : "The files could not be selected.");
                }
              }}
            >
              Choose files
            </button>
            {existingAttachmentPaths.map((path) => (
              <small key={path}>
                {path.split("/").at(-1)}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setExistingAttachmentPaths((current) => current.filter((item) => item !== path));
                    setHasUnsavedChanges(true);
                  }}
                >
                  Remove
                </button>
              </small>
            ))}
            {selectedAttachments.map((attachment, index) => (
              <small key={`${attachment.sourcePath}-${index}`}>
                {attachment.originalFileName}{" "}
                <button
                  type="button"
                  onClick={() => setSelectedAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                >
                  Remove
                </button>
              </small>
            ))}
          </div>
        )}

        <label className="financial-entry-form__field financial-entry-form__field--wide">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add context so this event can be audited later"
          />
        </label>
        {error && (
          <p id="financial-entry-form-error" className="financial-entry-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="financial-entry-form__actions">
          <button onClick={requestClose} type="button" disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Record event"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default FinancialEntryForm;
