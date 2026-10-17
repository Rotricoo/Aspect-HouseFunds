import type { EditableFinancialMovement, FinancialMovementCancellation, FinancialMovementType } from "../types/financial-movement";
import type { FundAdjustment } from "../types/fund-adjustment";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundContribution } from "../types/fund-contribution";
import type { FundTransfer } from "../types/fund-transfer";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";
import { formatCurrency, formatDate } from "../utils/formatters";
import type { Person } from "../types/person-id";
import type { PaymentSource } from "../types/payment-source";
import { getPersonName } from "../utils/household-labels";

interface Props {
  contributions: FundContribution[];
  refunds: Refund[];
  reimbursements: Reimbursement[];
  transfers: FundTransfer[];
  balanceChecks: FundBalanceCheck[];
  adjustments: FundAdjustment[];
  cancellations: FinancialMovementCancellation[];
  onCancellationChange: (type: FinancialMovementType, id: string, reason: string | null) => Promise<void>;
  onDelete: (type: FinancialMovementType, id: string) => Promise<void>;
  onEdit: (movement: EditableFinancialMovement) => void;
  people: Person[];
  paymentSources: PaymentSource[];
}

interface Row {
  type: FinancialMovementType;
  id: string;
  date: Date | null;
  title: string;
  detail: string;
  amount: number;
  movement: EditableFinancialMovement;
}

export default function FinancialMovementsAdmin(props: Props) {
  const rows: Row[] = [
    ...props.contributions.map((x) => ({
      type: "contribution" as const,
      id: x.id,
      date: x.date,
      title: `${getPersonName(x.contributorPersonId, props.people)} contribution`,
      detail: props.paymentSources.find((source) => source.id === x.fundSourceId)?.name ?? x.fundSourceId,
      amount: x.amount,
      movement: { type: "contribution" as const, value: x },
    })),
    ...props.refunds.map((x) => ({
      type: "refund" as const,
      id: x.id,
      date: x.date,
      title: `${x.merchant} refund`,
      detail: x.receivedToPaymentSourceId,
      amount: x.amount,
      movement: { type: "refund" as const, value: x },
    })),
    ...props.reimbursements.map((x) => ({
      type: "reimbursement" as const,
      id: x.id,
      date: x.date,
      title: `${getPersonName(x.fromPersonId, props.people)} → ${getPersonName(x.toPersonId, props.people)}`,
      detail: `${x.appliesTo} reimbursement`,
      amount: x.amount,
      movement: { type: "reimbursement" as const, value: x },
    })),
    ...props.transfers.map((x) => ({
      type: "transfer" as const,
      id: x.id,
      date: x.date,
      title: `${props.paymentSources.find((source) => source.id === x.fromPaymentSourceId)?.name ?? x.fromPaymentSourceId} → ${props.paymentSources.find((source) => source.id === x.toPaymentSourceId)?.name ?? x.toPaymentSourceId}`,
      detail: "Fund transfer",
      amount: x.amount,
      movement: { type: "transfer" as const, value: x },
    })),
    ...props.balanceChecks.map((x) => ({
      type: "balance-check" as const,
      id: x.id,
      date: x.checkedAt,
      title: `${props.paymentSources.find((source) => source.id === x.fundSourceId)?.name ?? x.fundSourceId} balance check`,
      detail: "Counted balance",
      amount: x.countedAmount,
      movement: { type: "balance-check" as const, value: x },
    })),
    ...props.adjustments.map((x) => ({
      type: "adjustment" as const,
      id: x.id,
      date: x.date,
      title: `${props.paymentSources.find((source) => source.id === x.fundSourceId)?.name ?? x.fundSourceId} ${x.direction}`,
      detail: x.reason,
      amount: x.amount,
      movement: { type: "adjustment" as const, value: x },
    })),
  ].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  const cancellationKeys = new Set(props.cancellations.map((item) => `${item.entityType}:${item.entityId}`));

  return (
    <details className="financial-movements-admin">
      <summary>
        Manage financial movements <span>{rows.length} records</span>
      </summary>
      <p>Cancelled records remain available for audit but no longer affect the report. Delete only entries created by mistake.</p>
      <div className="financial-movements-admin__list">
        {rows.map((row) => {
          const isCancelled = cancellationKeys.has(`${row.type}:${row.id}`);
          return (
            <article
              className={`financial-movements-admin__item ${isCancelled ? "financial-movements-admin__item--cancelled" : ""}`}
              key={`${row.type}:${row.id}`}
            >
              <div>
                <small>
                  {row.type} · {row.date ? formatDate(row.date) : "Date pending"}
                </small>
                <strong>{row.title}</strong>
                <span>{row.detail}</span>
              </div>
              <strong>{formatCurrency(row.amount)}</strong>
              <div className="financial-movements-admin__actions">
                <button type="button" onClick={() => props.onEdit(row.movement)} disabled={isCancelled}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (isCancelled) {
                      await props.onCancellationChange(row.type, row.id, null);
                      return;
                    }
                    const reason = window.prompt("Why is this movement being cancelled?");
                    if (reason?.trim()) await props.onCancellationChange(row.type, row.id, reason.trim());
                  }}
                >
                  {isCancelled ? "Reactivate" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Permanently delete this record? This cannot be undone.")) await props.onDelete(row.type, row.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </details>
  );
}
