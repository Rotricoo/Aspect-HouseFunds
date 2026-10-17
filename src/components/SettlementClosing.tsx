import { useEffect, useState } from "react";
import { closeSettlementPeriod, loadSettlementPeriods } from "../database/settlement-repository";
import type { FinancialReport } from "../types/financial-report";
import type { SettlementPeriod } from "../types/settlement-period";
import type { Reimbursement } from "../types/reimbursement";
import type { SettlementGroup } from "../types/settlement-group";
import type { SettlementGroupTransfer } from "../types/financial-report";
import { formatCurrency, formatDate } from "../utils/formatters";
import { formatDateOnly, monthDateRange, previousBrisbaneMonthInput } from "../utils/date-only";

interface SettlementClosingProps {
  createReportAt: (date: Date) => FinancialReport;
  reimbursements: Reimbursement[];
  settlementGroups: SettlementGroup[];
  onRecordPayment: (periodId: string, settlement: SettlementGroupTransfer, amount: number) => void;
}

export default function SettlementClosing({ createReportAt, reimbursements, settlementGroups, onRecordPayment }: SettlementClosingProps) {
  const [periods, setPeriods] = useState<SettlementPeriod[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(previousBrisbaneMonthInput());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    setPeriods(await loadSettlementPeriods());
  }

  useEffect(() => {
    void refresh().catch(() => setError("Settlement history could not be loaded."));
    const handleSettlementUpdate = () => void refresh().catch(() => setError("Settlement history could not be refreshed."));
    window.addEventListener("housefund-settlement-updated", handleSettlementUpdate);
    return () => window.removeEventListener("housefund-settlement-updated", handleSettlementUpdate);
  }, []);

  async function handleClosePeriod() {
    setError(null);
    setIsSaving(true);
    try {
      const { start: periodStart, end: periodEnd } = monthDateRange(selectedMonth);
      await closeSettlementPeriod({ periodStart, periodEnd, notes: notes.trim() || null, report: createReportAt(periodEnd) });
      setNotes("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The settlement period could not be closed.");
    } finally {
      setIsSaving(false);
    }
  }

  const groupByPersonId = new Map(settlementGroups.flatMap((group) => group.memberPersonIds.map((personId) => [personId, group] as const)));
  const reimbursementById = new Map(reimbursements.map((reimbursement) => [reimbursement.id, reimbursement]));
  const selectedMonthRange = monthDateRange(selectedMonth);
  const selectedPeriod = periods.find(
    (period) =>
      formatDateOnly(period.periodStart) === formatDateOnly(selectedMonthRange.start) &&
      formatDateOnly(period.periodEnd) === formatDateOnly(selectedMonthRange.end),
  );

  return (
    <section className="settlement-closing" aria-labelledby="settlement-closing-title">
      <div className="settlement-closing__heading">
        <div>
          <p className="settlement-closing__eyebrow">Month-end record</p>
          <h3 id="settlement-closing-title">Close and track a month</h3>
          <p>Records what each group owed at month end. It never changes the live financial report.</p>
        </div>
      </div>

      <div className="settlement-closing__form">
        <label>
          Month to close
          <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
        </label>
        <label className="settlement-closing__notes">
          Notes
          <input value={notes} placeholder="Optional context for this closing" onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button type="button" disabled={isSaving || !selectedMonth || Boolean(selectedPeriod)} onClick={() => void handleClosePeriod()}>
          {isSaving
            ? "Closing…"
            : selectedPeriod
              ? "Month already closed"
              : `Close ${formatDateOnly(selectedMonthRange.start).slice(0, 7)}`}
        </button>
      </div>
      {selectedPeriod && (
        <p className="settlement-closing__notice">
          This month already has a closing record. Open the history below to record a payment against it.
        </p>
      )}
      {error && (
        <p className="settlement-closing__error" role="alert">
          {error}
        </p>
      )}

      {periods.length === 0 ? (
        <p className="settlement-closing__empty">No settlement period has been closed yet.</p>
      ) : (
        <details className="settlement-closing__history">
          <summary>Closed-month history ({periods.length})</summary>
          <p className="settlement-closing__history-description">
            Use these records only to track payments against a completed month. Current balances remain in the live report.
          </p>
          <div className="settlement-closing__history-list">
            {periods.map((period) => {
              const overall = period.transfers.filter((transfer) => transfer.kind === "overall");
              const linkedPayments = period.reimbursementIds.flatMap((id) => {
                const payment = reimbursementById.get(id);
                return payment ? [payment] : [];
              });
              return (
                <article className="settlement-closing__period" key={period.id}>
                  <div>
                    <strong>
                      {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
                    </strong>
                    <span>
                      Closed {period.closedAt ? period.closedAt.toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) : "—"}
                    </span>
                  </div>
                  <div className="settlement-closing__transfers">
                    {overall.length === 0 && <span>Settled when closed</span>}
                    {overall.map((transfer) => {
                      const paid = linkedPayments
                        .filter(
                          (payment) =>
                            groupByPersonId.get(payment.fromPersonId)?.id === transfer.fromGroupId &&
                            groupByPersonId.get(payment.toPersonId)?.id === transfer.toGroupId,
                        )
                        .reduce((total, payment) => total + payment.amount, 0);
                      const remaining = Math.max(0, Math.round((transfer.amount - paid) * 100) / 100);
                      const settlement: SettlementGroupTransfer = {
                        fromGroupId: transfer.fromGroupId,
                        fromGroupName: settlementGroups.find((group) => group.id === transfer.fromGroupId)?.name ?? transfer.fromGroupId,
                        toGroupId: transfer.toGroupId,
                        toGroupName: settlementGroups.find((group) => group.id === transfer.toGroupId)?.name ?? transfer.toGroupId,
                        amount: transfer.amount,
                      };
                      return (
                        <div className="settlement-closing__transfer" key={transfer.id}>
                          <span>
                            At close: {settlement.fromGroupName} → {settlement.toGroupName} {formatCurrency(transfer.amount)}
                          </span>
                          <small>
                            Payments recorded {formatCurrency(paid)} · Still outstanding {formatCurrency(remaining)}
                          </small>
                          {remaining > 0 && (
                            <button type="button" onClick={() => onRecordPayment(period.id, settlement, remaining)}>
                              Record payment for this month
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {period.notes && <p>{period.notes}</p>}
                </article>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
