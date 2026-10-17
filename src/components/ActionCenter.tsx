import type { FinancialReport } from "../types/financial-report";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";
import type {
  RecurringBill,
  RecurringBillOccurrence,
  RecurringContributionOccurrence,
  RecurringContributionPlan,
} from "../types/recurring-bill";
import { formatCurrency, formatDate } from "../utils/formatters";
import { getSharedSourceLabel } from "../utils/household-labels";
import type { Person } from "../types/person-id";
import { getPersonName } from "../utils/household-labels";
import type { FinancialReportSection } from "./FundBalanceReport";

interface ActionCenterProps {
  report: FinancialReport;
  purchases: Purchase[];
  recurringBills: RecurringBill[];
  recurringBillOccurrences: RecurringBillOccurrence[];
  recurringContributionPlans: RecurringContributionPlan[];
  recurringContributionOccurrences: RecurringContributionOccurrence[];
  paymentSources: PaymentSource[];
  people: Person[];
  onNewPurchase: () => void;
  onOpenFinancialSection: (section: FinancialReportSection) => void;
}

interface ActionItem {
  id: string;
  title: string;
  detail: string;
  dueDate: Date;
  amount: number;
  status: "scheduled" | "overdue";
  section: FinancialReportSection;
}

function transferDescription(report: FinancialReport): string {
  const settlement = report.groupOverallSettlements[0];
  if (!settlement) return "The household is fully settled";
  return `${settlement.fromGroupName} pays ${settlement.toGroupName}`;
}

export default function ActionCenter({
  report,
  purchases,
  recurringBills,
  recurringBillOccurrences,
  recurringContributionPlans,
  recurringContributionOccurrences,
  paymentSources,
  people,
  onNewPurchase,
  onOpenFinancialSection,
}: ActionCenterProps) {
  const billById = new Map(recurringBills.map((bill) => [bill.id, bill]));
  const planById = new Map(recurringContributionPlans.map((plan) => [plan.id, plan]));
  const billActions: ActionItem[] = recurringBillOccurrences
    .filter((occurrence) => occurrence.status === "scheduled" || occurrence.status === "overdue")
    .map((occurrence) => ({
      id: occurrence.id,
      title: billById.get(occurrence.recurringBillId)?.name ?? "Recurring bill",
      detail: `Due ${formatDate(occurrence.dueDate)}`,
      dueDate: occurrence.dueDate,
      amount: occurrence.amount,
      status: occurrence.status as ActionItem["status"],
      section: "bills",
    }));
  const contributionActions: ActionItem[] = recurringContributionOccurrences
    .filter((occurrence) => occurrence.status === "scheduled" || occurrence.status === "overdue")
    .map((occurrence) => ({
      id: occurrence.id,
      title: `${getPersonName(occurrence.personId, people)} contribution`,
      detail: `${planById.get(occurrence.recurringContributionPlanId)?.name ?? "Household plan"} · ${formatDate(occurrence.dueDate)}`,
      dueDate: occurrence.dueDate,
      amount: occurrence.amount,
      status: occurrence.status as ActionItem["status"],
      section: "bills",
    }));
  const openActions = [...billActions, ...contributionActions].sort(
    (first, second) => first.dueDate.getTime() - second.dueDate.getTime() || first.title.localeCompare(second.title),
  );
  const attentionLimit = new Date();
  attentionLimit.setHours(23, 59, 59, 999);
  attentionLimit.setDate(attentionLimit.getDate() + 30);
  const attentionActions = openActions.filter((item) => item.status === "overdue" || item.dueDate <= attentionLimit);
  const visibleActions = attentionActions.slice(0, 6);
  const overdueCount = openActions.filter((item) => item.status === "overdue").length;
  const futureCount = openActions.length - attentionActions.length;
  const upcomingBillCount = billActions.filter((item) => attentionActions.some((action) => action.id === item.id)).length;
  const upcomingContributionCount = contributionActions.filter((item) => attentionActions.some((action) => action.id === item.id)).length;
  const settlement = report.groupOverallSettlements[0];
  const totalResponsibility = report.members.reduce((total, member) => total + member.totalResponsibility, 0);
  const totalSharedContribution = report.members.reduce((total, member) => total + member.sharedFundContribution, 0);
  const advancingMembers = report.members.filter((member) => member.immediatePersonalPaid > 0);
  const recentPurchases = [...purchases]
    .sort((first, second) => second.date.getTime() - first.date.getTime() || first.merchant.localeCompare(second.merchant))
    .slice(0, 4);

  return (
    <section className="action-center" aria-labelledby="action-center-title">
      <header className="action-center__hero">
        <div>
          <p className="action-center__eyebrow">Household command center</p>
          <h2 id="action-center-title">Dashboard</h2>
          <span>Current balances, upcoming commitments and the fastest path to the next action.</span>
        </div>
        <button type="button" className="action-center__primary-action" onClick={onNewPurchase}>
          <span aria-hidden="true">+</span> New purchase
        </button>
      </header>

      <div className="action-center__metrics">
        <button
          type="button"
          className="action-center__metric action-center__metric--primary"
          onClick={() => onOpenFinancialSection("overview")}
        >
          <span>Final household position</span>
          <strong>{settlement ? formatCurrency(settlement.amount) : "Settled"}</strong>
          <small>{transferDescription(report)}</small>
        </button>
        <button type="button" className="action-center__metric" onClick={() => onOpenFinancialSection("records")}>
          <span>Shared funds available</span>
          <strong>{formatCurrency(report.summary.sharedFundsExpectedBalance)}</strong>
          <small>{getSharedSourceLabel(paymentSources)}</small>
        </button>
        <button type="button" className="action-center__metric" onClick={() => onOpenFinancialSection("afterpay")}>
          <span>Afterpay remaining</span>
          <strong>{formatCurrency(report.summary.afterpayCommitted)}</strong>
          <small>Confirmed outstanding commitment</small>
        </button>
        <button type="button" className="action-center__metric" onClick={() => onOpenFinancialSection("bills")}>
          <span>Due in the next 30 days</span>
          <strong>{attentionActions.length} actions</strong>
          <small>
            {overdueCount > 0
              ? `${overdueCount} overdue · ${upcomingBillCount} bills · ${upcomingContributionCount} contributions`
              : `${upcomingBillCount} bills · ${upcomingContributionCount} contributions${futureCount > 0 ? ` · ${futureCount} later` : ""}`}
          </small>
        </button>
      </div>

      <details className="action-center__why-balance">
        <summary>Why this balance?</summary>
        <p className="action-center__why-balance-intro">
          This view explains how recorded purchases, shared money and future commitments combine into the current household position.
        </p>
        <div className="action-center__why-balance-grid">
          <div>
            <span>Purchase responsibility</span>
            <strong>{formatCurrency(totalResponsibility)}</strong>
            <small>Shared responsibility assigned to household members.</small>
          </div>
          <div>
            <span>Who advanced money</span>
            <strong>{formatCurrency(report.summary.personallyAdvancedNow)}</strong>
            <small>
              {advancingMembers.length > 0
                ? advancingMembers.map((member) => getPersonName(member.personId, people)).join(", ")
                : "No personal advance recorded yet."}
            </small>
          </div>
          <div>
            <span>Shared fund contribution</span>
            <strong>{formatCurrency(totalSharedContribution)}</strong>
            <small>Money contributed toward shared household spending.</small>
          </div>
          <div>
            <span>Future pay-later commitment</span>
            <strong>{formatCurrency(report.summary.afterpayCommitted)}</strong>
            <small>Confirmed amount still committed to future payments.</small>
          </div>
        </div>
        <div className="action-center__why-balance-final">
          <span>Final settlement calculation</span>
          <strong>
            {settlement ? `${transferDescription(report)} · ${formatCurrency(settlement.amount)}` : "The household is fully settled"}
          </strong>
        </div>
      </details>

      <div className="action-center__grid">
        <section className="action-center__panel" aria-labelledby="action-center-next-title">
          <div className="action-center__panel-heading">
            <div>
              <p>Next up</p>
              <h3 id="action-center-next-title">Bills and contributions</h3>
            </div>
            <button type="button" onClick={() => onOpenFinancialSection("bills")}>
              View schedule
            </button>
          </div>
          {visibleActions.length === 0 ? (
            <p className="action-center__empty">
              Nothing needs attention right now. Your next scheduled bill or contribution will appear here.
            </p>
          ) : (
            <ul className="action-center__action-list">
              {visibleActions.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onOpenFinancialSection(item.section)}>
                    <span className={`action-center__status action-center__status--${item.status}`} aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="action-center__panel" aria-labelledby="action-center-recent-title">
          <div className="action-center__panel-heading">
            <div>
              <p>Latest activity</p>
              <h3 id="action-center-recent-title">Recent purchases</h3>
            </div>
            <button type="button" onClick={() => onOpenFinancialSection("overview")}>
              View report
            </button>
          </div>
          <ul className="action-center__purchase-list">
            {recentPurchases.map((purchase) => (
              <li key={purchase.id}>
                <span>
                  <strong>{purchase.merchant}</strong>
                  <small>{formatDate(purchase.date)}</small>
                </span>
                <strong>{formatCurrency(purchase.receiptTotal)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
