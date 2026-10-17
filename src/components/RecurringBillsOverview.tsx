import { useState } from "react";
import type {
  RecurringBill,
  RecurringBillOccurrence,
  RecurringContributionOccurrence,
  RecurringContributionPlan,
} from "../types/recurring-bill";
import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";
import { formatCurrency, formatDate } from "../utils/formatters";
import { getPersonName } from "../utils/household-labels";
import RecurringBillOccurrenceForm from "./RecurringBillOccurrenceForm";
import type { StoredAttachment } from "../services/attachment-service";
import RecurringBillForm from "./RecurringBillForm";
import RecurringContributionOccurrenceForm from "./RecurringContributionOccurrenceForm";
import RecurringContributionPlanForm from "./RecurringContributionPlanForm";

interface RecurringBillsOverviewProps {
  bills: RecurringBill[];
  occurrences: RecurringBillOccurrence[];
  contributionPlans: RecurringContributionPlan[];
  contributionOccurrences: RecurringContributionOccurrence[];
  onContributionOccurrenceSave: (occurrence: RecurringContributionOccurrence, plan: RecurringContributionPlan) => Promise<void>;
  onOccurrenceSave: (bill: RecurringBill, occurrence: RecurringBillOccurrence, attachments: StoredAttachment[]) => Promise<void>;
  paymentSources: PaymentSource[];
  onBillSave: (bill: RecurringBill, effectiveFrom: Date) => Promise<void>;
  onBillDelete: (bill: RecurringBill) => Promise<void>;
  onContributionPlanSave: (plan: RecurringContributionPlan, effectiveFrom: Date) => Promise<void>;
  onContributionPlanDelete: (plan: RecurringContributionPlan) => Promise<void>;
  categories?: string[];
  people: Person[];
}

type OccurrenceStatusFilter = "all" | "open" | RecurringBillOccurrence["status"];

const OCCURRENCES_PER_PAGE = 10;

function formatFrequency(frequency: RecurringBill["frequency"]): string {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function calculateTargetPaymentDate(dueDate: Date, leadDays: number): Date {
  const targetDate = new Date(dueDate);
  targetDate.setDate(targetDate.getDate() - leadDays);
  return targetDate;
}

function RecurringBillsOverview({
  bills,
  occurrences,
  contributionPlans,
  contributionOccurrences,
  onContributionOccurrenceSave,
  onOccurrenceSave,
  paymentSources,
  onBillSave,
  onBillDelete,
  onContributionPlanSave,
  onContributionPlanDelete,
  categories = [],
  people,
}: RecurringBillsOverviewProps) {
  const [billFilter, setBillFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<OccurrenceStatusFilter>("open");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOccurrence, setSelectedOccurrence] = useState<RecurringBillOccurrence | null>(null);
  const [billBeingEdited, setBillBeingEdited] = useState<RecurringBill | null | "new">(null);
  const [selectedContributionOccurrence, setSelectedContributionOccurrence] = useState<RecurringContributionOccurrence | null>(null);
  const [planBeingEdited, setPlanBeingEdited] = useState<RecurringContributionPlan | null | "new">(null);
  const billById = new Map(bills.map((bill) => [bill.id, bill]));
  const sourceById = new Map(paymentSources.map((source) => [source.id, source]));
  const sortedOccurrences = [...occurrences].sort((first, second) => first.dueDate.getTime() - second.dueDate.getTime());
  const openRentOccurrences = sortedOccurrences.filter((occurrence) => {
    const bill = billById.get(occurrence.recurringBillId);
    return bill?.category === "Rent" && occurrence.status !== "paid" && occurrence.status !== "cancelled";
  });
  const openRentTotal = openRentOccurrences.reduce((total, occurrence) => total + occurrence.amount, 0);
  const rentCoveredThrough = openRentOccurrences.at(-1)?.periodEndDate ?? null;
  const filteredOccurrences = sortedOccurrences.filter((occurrence) => {
    const matchesBill = billFilter === "all" || occurrence.recurringBillId === billFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "open" ? occurrence.status !== "paid" && occurrence.status !== "cancelled" : occurrence.status === statusFilter);
    return matchesBill && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredOccurrences.length / OCCURRENCES_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstVisibleIndex = (safeCurrentPage - 1) * OCCURRENCES_PER_PAGE;
  const visibleOccurrences = filteredOccurrences.slice(firstVisibleIndex, firstVisibleIndex + OCCURRENCES_PER_PAGE);

  function updateBillFilter(value: string) {
    setBillFilter(value);
    setCurrentPage(1);
  }

  function updateStatusFilter(value: OccurrenceStatusFilter) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  return (
    <section className="fund-balance-report__section recurring-bills" aria-labelledby="recurring-bills-title">
      <div className="recurring-bills__heading">
        <div>
          <p>Scheduled household commitments</p>
          <h3 className="fund-balance-report__section-title" id="recurring-bills-title">
            Rent & recurring bills
          </h3>
        </div>
        <div>
          <span>{bills.filter((bill) => bill.isActive).length} active bills</span>
          <button type="button" onClick={() => setBillBeingEdited("new")}>
            + New bill
          </button>
        </div>
      </div>

      <div className="recurring-bills__templates">
        {bills.map((bill) => (
          <article
            className="recurring-bills__template"
            key={bill.id}
            tabIndex={0}
            role="button"
            onClick={() => setBillBeingEdited(bill)}
            onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setBillBeingEdited(bill)}
          >
            <div>
              <strong>{bill.name}</strong>
              <span>{formatFrequency(bill.frequency)}</span>
            </div>
            <strong>{bill.defaultAmount === null ? "Variable" : formatCurrency(bill.defaultAmount)}</strong>
            <small>
              Default: {sourceById.get(bill.defaultPaymentSourceId)?.name ?? "Not confirmed"}
              {bill.endsOn ? ` · Contract ends ${formatDate(bill.endsOn)}` : ""}
            </small>
          </article>
        ))}
      </div>

      <aside className="recurring-bills__upcoming-summary" aria-label="Open rent payment summary">
        <div>
          <span>Open rent payments</span>
          <strong>{openRentOccurrences.length} scheduled rents</strong>
        </div>
        <div>
          <span>Scheduled total</span>
          <strong>{formatCurrency(openRentTotal)}</strong>
        </div>
        <div>
          <span>Rent covered through</span>
          <strong>{rentCoveredThrough ? formatDate(rentCoveredThrough) : "No open rent"}</strong>
        </div>
      </aside>

      <div className="recurring-bills__plan-heading">
        <h4>Household contribution plans</h4>
        <button type="button" onClick={() => setPlanBeingEdited("new")}>
          + New plan
        </button>
      </div>
      {contributionPlans.map((plan) => {
        const weeklyTotal = plan.amountPerPerson * plan.contributorPersonIds.length;
        const rentBill = bills.find((bill) => bill.category === "Rent" && bill.frequency === plan.frequency);
        const expectedSurplus =
          rentBill?.defaultAmount === null || rentBill?.defaultAmount === undefined ? null : weeklyTotal - rentBill.defaultAmount;

        return (
          <aside
            className="recurring-bills__contribution-plan"
            key={plan.id}
            role="button"
            tabIndex={0}
            onClick={() => setPlanBeingEdited(plan)}
            onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setPlanBeingEdited(plan)}
          >
            <div>
              <strong>{plan.name}</strong>
              <span>
                {plan.contributorPersonIds
                  .map((personId) => `${getPersonName(personId, people)} ${formatCurrency(plan.amountPerPerson)}`)
                  .join(" · ")}
              </span>
            </div>
            <div>
              <strong>{formatCurrency(weeklyTotal)} per week</strong>
              <span>
                {expectedSurplus === null
                  ? "Surplus depends on the bill amount"
                  : `${formatCurrency(expectedSurplus)} expected to remain after rent for other bills`}
              </span>
            </div>
          </aside>
        );
      })}

      <details className="recurring-bills__contribution-schedule">
        <summary>Weekly contribution schedule</summary>
        <div className="fund-balance-report__table-wrapper">
          <table className="fund-balance-report__table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Due date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid date</th>
              </tr>
            </thead>
            <tbody>
              {contributionOccurrences.slice(0, 12).map((occurrence) => (
                <tr
                  className="recurring-bills__row"
                  key={occurrence.id}
                  tabIndex={0}
                  onClick={() => setSelectedContributionOccurrence(occurrence)}
                  onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelectedContributionOccurrence(occurrence)}
                >
                  <th>{getPersonName(occurrence.personId, people)}</th>
                  <td>{formatDate(occurrence.dueDate)}</td>
                  <td>{formatCurrency(occurrence.amount)}</td>
                  <td>
                    <span className={`recurring-bills__status recurring-bills__status--${occurrence.status}`}>{occurrence.status}</span>
                  </td>
                  <td>{occurrence.paidDate ? formatDate(occurrence.paidDate) : "Not paid"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="recurring-bills__controls" aria-label="Recurring payment filters">
        <label>
          <span>Bill</span>
          <select value={billFilter} onChange={(event) => updateBillFilter(event.target.value)}>
            <option value="all">All bills</option>
            {bills.map((bill) => (
              <option value={bill.id} key={bill.id}>
                {bill.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value as OccurrenceStatusFilter)}>
            <option value="open">Open</option>
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <span className="recurring-bills__result-count">{filteredOccurrences.length} payments</span>
      </div>

      <div className="fund-balance-report__table-wrapper">
        <table className="fund-balance-report__table">
          <caption>Generated charges and their payment status</caption>
          <thead>
            <tr>
              <th scope="col">Bill</th>
              <th scope="col">Period</th>
              <th scope="col">Target payment</th>
              <th scope="col">Due date</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Paid date</th>
              <th scope="col">Payment source</th>
            </tr>
          </thead>
          <tbody>
            {visibleOccurrences.map((occurrence) => {
              const bill = billById.get(occurrence.recurringBillId);
              return (
                <tr
                  className="recurring-bills__row"
                  key={occurrence.id}
                  onClick={() => setSelectedOccurrence(occurrence)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOccurrence(occurrence);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Edit ${bill?.name ?? "recurring payment"} due ${formatDate(occurrence.dueDate)}`}
                >
                  <th scope="row">{bill?.name ?? "Unknown bill"}</th>
                  <td>
                    {formatDate(occurrence.periodStartDate)} – {formatDate(occurrence.periodEndDate)}
                  </td>
                  <td>{formatDate(calculateTargetPaymentDate(occurrence.dueDate, bill?.preferredPaymentLeadDays ?? 0))}</td>
                  <td>{formatDate(occurrence.dueDate)}</td>
                  <td>{formatCurrency(occurrence.amount)}</td>
                  <td>
                    <span className={`recurring-bills__status recurring-bills__status--${occurrence.status}`}>{occurrence.status}</span>
                  </td>
                  <td>{occurrence.paidDate ? formatDate(occurrence.paidDate) : "Not paid"}</td>
                  <td>
                    {occurrence.paymentSourceId ? (sourceById.get(occurrence.paymentSourceId)?.name ?? "Unknown source") : "Not selected"}
                  </td>
                </tr>
              );
            })}
            {visibleOccurrences.length === 0 && (
              <tr>
                <td className="recurring-bills__empty" colSpan={8}>
                  No payments match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredOccurrences.length > OCCURRENCES_PER_PAGE && (
        <nav className="recurring-bills__pagination" aria-label="Recurring payments pages">
          <button disabled={safeCurrentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} type="button">
            Previous
          </button>
          <span>
            {firstVisibleIndex + 1}–{Math.min(firstVisibleIndex + OCCURRENCES_PER_PAGE, filteredOccurrences.length)} of{" "}
            {filteredOccurrences.length}
          </span>
          <button
            disabled={safeCurrentPage === totalPages}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            type="button"
          >
            Next
          </button>
        </nav>
      )}

      {selectedOccurrence && billById.get(selectedOccurrence.recurringBillId) && (
        <RecurringBillOccurrenceForm
          bill={billById.get(selectedOccurrence.recurringBillId)!}
          occurrence={selectedOccurrence}
          paymentSources={paymentSources}
          onClose={() => setSelectedOccurrence(null)}
          onSave={(updatedOccurrence, attachments) =>
            onOccurrenceSave(billById.get(updatedOccurrence.recurringBillId)!, updatedOccurrence, attachments)
          }
        />
      )}
      {billBeingEdited && (
        <RecurringBillForm
          bill={billBeingEdited === "new" ? undefined : billBeingEdited}
          paymentSources={paymentSources}
          categories={categories}
          people={people}
          onClose={() => setBillBeingEdited(null)}
          onSave={async (bill, effectiveFrom) => {
            await onBillSave(bill, effectiveFrom);
            setBillBeingEdited(null);
          }}
          onDelete={
            billBeingEdited === "new"
              ? undefined
              : async () => {
                  await onBillDelete(billBeingEdited);
                  setBillBeingEdited(null);
                }
          }
        />
      )}
      {selectedContributionOccurrence &&
        (() => {
          const plan = contributionPlans.find((item) => item.id === selectedContributionOccurrence.recurringContributionPlanId);
          return plan ? (
            <RecurringContributionOccurrenceForm
              occurrence={selectedContributionOccurrence}
              plan={plan}
              people={people}
              onClose={() => setSelectedContributionOccurrence(null)}
              onSave={(value) => onContributionOccurrenceSave(value, plan)}
            />
          ) : null;
        })()}
      {planBeingEdited && (
        <RecurringContributionPlanForm
          plan={planBeingEdited === "new" ? undefined : planBeingEdited}
          paymentSources={paymentSources}
          people={people}
          onClose={() => setPlanBeingEdited(null)}
          onSave={async (plan, effectiveFrom) => {
            await onContributionPlanSave(plan, effectiveFrom);
            setPlanBeingEdited(null);
          }}
          onDelete={
            planBeingEdited === "new"
              ? undefined
              : async () => {
                  await onContributionPlanDelete(planBeingEdited);
                  setPlanBeingEdited(null);
                }
          }
        />
      )}
    </section>
  );
}

export default RecurringBillsOverview;
