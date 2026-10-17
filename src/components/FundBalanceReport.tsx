import { useState } from "react";
import type { SettlementGroupTransfer, SettlementTransfer } from "../types/financial-report";
import type { PaymentSource } from "../types/payment-source";
import type { SettlementGroup } from "../types/settlement-group";
import type { Purchase } from "../types/purchase";
import type { FundContribution } from "../types/fund-contribution";
import type { PaymentInstallment } from "../types/payment-installment";
import { formatCurrency, formatDate } from "../utils/formatters";
import { createCurrentFinancialReport } from "../utils/current-financial-report";
import FundContributionForm from "./FundContributionForm";
import FinancialOverview from "./FinancialOverview";
import RecurringBillsOverview from "./RecurringBillsOverview";
import AfterpayInstallmentsOverview from "./AfterpayInstallmentsOverview";
import FinancialEntryForm from "./FinancialEntryForm";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";
import type { FundTransfer } from "../types/fund-transfer";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundAdjustment } from "../types/fund-adjustment";
import type {
  RecurringBill,
  RecurringBillOccurrence,
  RecurringContributionOccurrence,
  RecurringContributionPlan,
} from "../types/recurring-bill";
import type { StoredAttachment } from "../services/attachment-service";
import type { EditableFinancialMovement, FinancialMovementCancellation, FinancialMovementType } from "../types/financial-movement";
import FinancialMovementsAdmin from "./FinancialMovementsAdmin";
import SettlementSnapshot from "./SettlementSnapshot";
import DatabaseMaintenance from "./DatabaseMaintenance";
import CategoryManager from "./CategoryManager";
import type { Category } from "../types/category";
import type { AfterpayPayment } from "../types/afterpay-payment";
import SettlementClosing from "./SettlementClosing";
import AuditLog from "./AuditLog";
import AppSettingsManager from "./AppSettingsManager";
import FinancialAccountingTables from "./FinancialAccountingTables";
import HouseholdSetupManager from "./HouseholdSetupManager";
import type { Person } from "../types/person-id";
import { getPersonName } from "../utils/household-labels";

export type FinancialReportSection = "overview" | "bills" | "afterpay" | "records";

interface FundBalanceReportProps {
  purchases: Purchase[];
  contributions: FundContribution[];
  paymentInstallments: PaymentInstallment[];
  afterpayPayments: AfterpayPayment[];
  refunds: Refund[];
  reimbursements: Reimbursement[];
  fundTransfers: FundTransfer[];
  balanceChecks: FundBalanceCheck[];
  fundAdjustments: FundAdjustment[];
  recurringBills: RecurringBill[];
  recurringBillOccurrences: RecurringBillOccurrence[];
  recurringContributionPlans: RecurringContributionPlan[];
  recurringContributionOccurrences: RecurringContributionOccurrence[];
  paymentSources: PaymentSource[];
  people: Person[];
  settlementGroups: SettlementGroup[];
  cancellations: FinancialMovementCancellation[];
  categories: Category[];
  isHeroCompact: boolean;
  initialSection?: FinancialReportSection;
  onContributionAdd: (contribution: FundContribution) => Promise<void>;
  onAfterpayPaymentSave: (payment: AfterpayPayment) => Promise<void>;
  onAfterpayPaymentDelete: (payment: AfterpayPayment) => Promise<void>;
  onRefundAdd: (refund: Refund) => Promise<void>;
  onReimbursementAdd: (reimbursement: Reimbursement, settlementPeriodId?: string) => Promise<void>;
  onFundTransferAdd: (transfer: FundTransfer) => Promise<void>;
  onBalanceCheckAdd: (balanceCheck: FundBalanceCheck) => Promise<void>;
  onFundAdjustmentAdd: (adjustment: FundAdjustment) => Promise<void>;
  onRecurringBillOccurrenceSave: (
    bill: RecurringBill,
    occurrence: RecurringBillOccurrence,
    attachments: StoredAttachment[],
  ) => Promise<void>;
  onRecurringBillSave: (bill: RecurringBill, effectiveFrom: Date) => Promise<void>;
  onRecurringBillDelete: (bill: RecurringBill) => Promise<void>;
  onRecurringContributionOccurrenceSave: (occurrence: RecurringContributionOccurrence, plan: RecurringContributionPlan) => Promise<void>;
  onRecurringContributionPlanSave: (plan: RecurringContributionPlan, effectiveFrom: Date) => Promise<void>;
  onRecurringContributionPlanDelete: (plan: RecurringContributionPlan) => Promise<void>;
  onMovementCancellationChange: (type: FinancialMovementType, id: string, reason: string | null) => Promise<void>;
  onMovementDelete: (type: FinancialMovementType, id: string) => Promise<void>;
  onCategorySave: (category: Category) => Promise<void>;
  onCategoryDelete: (category: Category) => Promise<void>;
  onSavePerson: (person: Person) => Promise<void>;
  onDeletePerson: (person: Person) => Promise<void>;
  onSaveSource: (source: PaymentSource) => Promise<void>;
  onDeleteSource: (source: PaymentSource) => Promise<void>;
  onSaveGroup: (group: SettlementGroup) => Promise<void>;
  onDeleteGroup: (group: SettlementGroup) => Promise<void>;
}

interface SettlementListProps {
  emptyMessage: string;
  settlements: SettlementTransfer[];
  people: Person[];
}

interface GroupSettlementListProps {
  emptyMessage: string;
  settlements: SettlementGroupTransfer[];
  onRecord?: (settlement: SettlementGroupTransfer) => void;
}

function SettlementList({ emptyMessage, settlements, people }: SettlementListProps) {
  if (settlements.length === 0) {
    return <p className="fund-balance-report__empty-state">{emptyMessage}</p>;
  }

  return (
    <ul className="fund-balance-report__settlement-list">
      {settlements.map((settlement) => (
        <li className="fund-balance-report__settlement" key={`${settlement.fromPersonId}-${settlement.toPersonId}-${settlement.amount}`}>
          {getPersonName(settlement.fromPersonId, people)} pays {getPersonName(settlement.toPersonId, people)}{" "}
          {formatCurrency(settlement.amount)}
        </li>
      ))}
    </ul>
  );
}

function GroupSettlementList({ emptyMessage, settlements, onRecord }: GroupSettlementListProps) {
  if (settlements.length === 0) {
    return <p className="fund-balance-report__empty-state">{emptyMessage}</p>;
  }

  return (
    <ul className="fund-balance-report__settlement-list">
      {settlements.map((settlement) => (
        <li className="fund-balance-report__settlement" key={`${settlement.fromGroupId}-${settlement.toGroupId}-${settlement.amount}`}>
          <span>
            {settlement.fromGroupName} pays {settlement.toGroupName} {formatCurrency(settlement.amount)}
          </span>
          {onRecord && (
            <button type="button" onClick={() => onRecord(settlement)}>
              Record payment
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FundBalanceReport({
  purchases,
  contributions,
  paymentInstallments,
  afterpayPayments,
  refunds,
  reimbursements,
  fundTransfers,
  balanceChecks,
  fundAdjustments,
  recurringBills,
  recurringBillOccurrences,
  recurringContributionPlans,
  recurringContributionOccurrences,
  paymentSources,
  people,
  settlementGroups,
  cancellations,
  categories,
  isHeroCompact,
  initialSection = "overview",
  onContributionAdd,
  onAfterpayPaymentSave,
  onAfterpayPaymentDelete,
  onRefundAdd,
  onReimbursementAdd,
  onFundTransferAdd,
  onBalanceCheckAdd,
  onFundAdjustmentAdd,
  onRecurringBillOccurrenceSave,
  onRecurringBillSave,
  onRecurringBillDelete,
  onRecurringContributionOccurrenceSave,
  onRecurringContributionPlanSave,
  onRecurringContributionPlanDelete,
  onMovementCancellationChange,
  onMovementDelete,
  onCategorySave,
  onCategoryDelete,
  onSavePerson,
  onDeletePerson,
  onSaveSource,
  onDeleteSource,
  onSaveGroup,
  onDeleteGroup,
}: FundBalanceReportProps) {
  const [isContributionFormOpen, setIsContributionFormOpen] = useState(false);
  const [isFinancialEntryFormOpen, setIsFinancialEntryFormOpen] = useState(false);
  const [movementBeingEdited, setMovementBeingEdited] = useState<EditableFinancialMovement | null>(null);
  const [settlementDraft, setSettlementDraft] = useState<Reimbursement | null>(null);
  const [settlementPeriodId, setSettlementPeriodId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<FinancialReportSection>(initialSection);
  const cancelled = new Set(cancellations.map((item) => `${item.entityType}:${item.entityId}`));
  const active = <T extends { id: string }>(type: FinancialMovementType, values: T[]) =>
    values.filter((value) => !cancelled.has(`${type}:${value.id}`));
  const report = createCurrentFinancialReport({
    purchases,
    contributions,
    paymentInstallments,
    afterpayPayments,
    refunds,
    reimbursements,
    fundTransfers,
    balanceChecks,
    fundAdjustments,
    paymentSources,
    settlementGroups,
    cancellations,
    people,
  });

  function openSettlementPayment(
    settlement: SettlementGroupTransfer,
    appliesTo: Reimbursement["appliesTo"],
    options?: { amount?: number; periodId?: string },
  ) {
    const fromPersonId = settlementGroups.find((group) => group.id === settlement.fromGroupId)?.memberPersonIds[0];
    const toPersonId = settlementGroups.find((group) => group.id === settlement.toGroupId)?.memberPersonIds[0];
    if (!fromPersonId || !toPersonId) return;
    const preferredSource =
      paymentSources.find((source) => source.ownership === fromPersonId && source.type === "bank-account") ??
      paymentSources.find((source) => source.ownership === fromPersonId && source.type !== "afterpay");
    if (!preferredSource) return;
    setSettlementDraft({
      id: crypto.randomUUID(),
      date: new Date(),
      fromPersonId,
      toPersonId,
      amount: options?.amount ?? settlement.amount,
      paymentSourceId: preferredSource.id,
      appliesTo,
      relatedPurchaseIds: [],
      notes: `Settlement payment from ${settlement.fromGroupName} to ${settlement.toGroupName}.`,
    });
    setSettlementPeriodId(options?.periodId ?? null);
    setIsFinancialEntryFormOpen(true);
  }

  return (
    <section className="fund-balance-report" aria-labelledby="fund-balance-report-title">
      <header
        className={`page-hero page-hero--financial page-hero--sticky fund-balance-report__header ${isHeroCompact ? "page-hero--compact" : ""}`}
      >
        <div className="page-hero__content">
          <p className="page-hero__eyebrow">Live household position</p>
          <div className="page-hero__summary">
            <h2 className="page-hero__title fund-balance-report__title" id="fund-balance-report-title">
              Financial Report
            </h2>
            <p className="page-hero__description fund-balance-report__date">Information recorded through {formatDate(report.asOfDate)}</p>
          </div>
        </div>
        <div className="fund-balance-report__hero-actions">
          <button className="fund-balance-report__secondary-action" onClick={() => setIsFinancialEntryFormOpen(true)} type="button">
            Record financial event
          </button>
          <button
            className="page-hero__action fund-balance-report__new-entry"
            onClick={() => setIsContributionFormOpen(true)}
            type="button"
          >
            <span aria-hidden="true">+</span> One-off contribution
          </button>
        </div>
      </header>

      {(isContributionFormOpen || movementBeingEdited?.type === "contribution") && (
        <FundContributionForm
          contribution={movementBeingEdited?.type === "contribution" ? movementBeingEdited.value : undefined}
          paymentSources={paymentSources}
          people={people}
          onClose={() => {
            setIsContributionFormOpen(false);
            setMovementBeingEdited(null);
          }}
          onSubmit={async (contribution) => {
            await onContributionAdd(contribution);
            setIsContributionFormOpen(false);
            setMovementBeingEdited(null);
          }}
        />
      )}

      {(isFinancialEntryFormOpen || (movementBeingEdited && movementBeingEdited.type !== "contribution")) && (
        <FinancialEntryForm
          entryToEdit={movementBeingEdited && movementBeingEdited.type !== "contribution" ? movementBeingEdited : undefined}
          reimbursementDraft={settlementDraft ?? undefined}
          purchases={purchases}
          paymentSources={paymentSources}
          people={people}
          onClose={() => {
            setIsFinancialEntryFormOpen(false);
            setMovementBeingEdited(null);
            setSettlementDraft(null);
            setSettlementPeriodId(null);
          }}
          onRefundAdd={async (refund) => {
            await onRefundAdd(refund);
            setIsFinancialEntryFormOpen(false);
            setMovementBeingEdited(null);
          }}
          onReimbursementAdd={async (reimbursement) => {
            await onReimbursementAdd(reimbursement, settlementPeriodId ?? undefined);
            if (settlementPeriodId) window.dispatchEvent(new CustomEvent("housefund-settlement-updated"));
            setIsFinancialEntryFormOpen(false);
            setMovementBeingEdited(null);
            setSettlementDraft(null);
            setSettlementPeriodId(null);
          }}
          onTransferAdd={async (transfer) => {
            await onFundTransferAdd(transfer);
            setIsFinancialEntryFormOpen(false);
            setMovementBeingEdited(null);
          }}
          onBalanceCheckAdd={async (balanceCheck) => {
            await onBalanceCheckAdd(balanceCheck);
            setIsFinancialEntryFormOpen(false);
            setMovementBeingEdited(null);
          }}
          onAdjustmentAdd={async (adjustment) => {
            await onFundAdjustmentAdd(adjustment);
            setIsFinancialEntryFormOpen(false);
            setMovementBeingEdited(null);
          }}
        />
      )}

      <nav className="fund-balance-report__navigation" aria-label="Financial report sections">
        {(
          [
            ["overview", "Overview"],
            ["bills", "Bills & contributions"],
            ["afterpay", "Afterpay"],
            ["records", "Records & settings"],
          ] as const
        ).map(([section, label]) => (
          <button
            className={`fund-balance-report__navigation-button ${activeSection === section ? "fund-balance-report__navigation-button--active" : ""}`}
            type="button"
            aria-pressed={activeSection === section}
            onClick={() => setActiveSection(section)}
            key={section}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeSection === "overview" && (
        <div className="fund-balance-report__section-content">
          <FinancialOverview purchases={purchases} report={report} paymentSources={paymentSources} />
          <SettlementSnapshot
            report={report}
            purchases={purchases}
            contributions={active("contribution", contributions)}
            paymentSources={paymentSources}
            settlementGroups={settlementGroups}
            people={people}
          />
        </div>
      )}

      {activeSection === "bills" && (
        <RecurringBillsOverview
          bills={recurringBills}
          occurrences={recurringBillOccurrences}
          contributionPlans={recurringContributionPlans}
          contributionOccurrences={recurringContributionOccurrences}
          people={people}
          onContributionOccurrenceSave={onRecurringContributionOccurrenceSave}
          onContributionPlanSave={onRecurringContributionPlanSave}
          onContributionPlanDelete={onRecurringContributionPlanDelete}
          paymentSources={paymentSources}
          onOccurrenceSave={onRecurringBillOccurrenceSave}
          onBillSave={onRecurringBillSave}
          onBillDelete={onRecurringBillDelete}
          categories={categories.filter((category) => category.isActive).map((category) => category.name)}
        />
      )}

      {activeSection === "afterpay" && (
        <AfterpayInstallmentsOverview
          installments={paymentInstallments}
          payments={afterpayPayments}
          purchases={purchases}
          paymentSources={paymentSources}
          onPaymentSave={onAfterpayPaymentSave}
          onPaymentDelete={onAfterpayPaymentDelete}
        />
      )}

      {activeSection === "records" && (
        <div className="fund-balance-report__section-content">
          <SettlementClosing
            reimbursements={reimbursements}
            settlementGroups={settlementGroups}
            onRecordPayment={(periodId, settlement, amount) => openSettlementPayment(settlement, "immediate", { periodId, amount })}
            createReportAt={(asOfDate) =>
              createCurrentFinancialReport({
                purchases,
                contributions,
                paymentInstallments,
                afterpayPayments,
                refunds,
                reimbursements,
                fundTransfers,
                balanceChecks,
                fundAdjustments,
                paymentSources,
                settlementGroups,
                cancellations,
                people,
                asOfDate,
              })
            }
          />
          <details className="fund-balance-report__records-group">
            <summary>Manage recorded financial movements</summary>
            <FinancialMovementsAdmin
              contributions={contributions}
              refunds={refunds}
              reimbursements={reimbursements}
              transfers={fundTransfers}
              balanceChecks={balanceChecks}
              adjustments={fundAdjustments}
              cancellations={cancellations}
              onCancellationChange={onMovementCancellationChange}
              onDelete={onMovementDelete}
              onEdit={setMovementBeingEdited}
              people={people}
              paymentSources={paymentSources}
            />
          </details>

          <details className="fund-balance-report__records-group">
            <summary>Data, backups and application settings</summary>
            <div className="fund-balance-report__records-stack">
              <DatabaseMaintenance />
              <AppSettingsManager />
              <HouseholdSetupManager
                people={people}
                paymentSources={paymentSources}
                settlementGroups={settlementGroups}
                onSavePerson={onSavePerson}
                onDeletePerson={onDeletePerson}
                onSaveSource={onSaveSource}
                onDeleteSource={onDeleteSource}
                onSaveGroup={onSaveGroup}
                onDeleteGroup={onDeleteGroup}
              />
              <CategoryManager categories={categories} onSave={onCategorySave} onDelete={onCategoryDelete} />
            </div>
          </details>

          <details className="fund-balance-report__records-group">
            <summary>Audit history</summary>
            <AuditLog />
          </details>

          <FinancialAccountingTables report={report} people={people} />

          <section className="fund-balance-report__section" aria-labelledby="settlements-title">
            <h3 className="fund-balance-report__section-title" id="settlements-title">
              Who should pay whom
            </h3>
            <h4 className="fund-balance-report__subheading">Final household settlement — all recorded accounts and commitments</h4>
            <GroupSettlementList emptyMessage="The financial groups are fully settled." settlements={report.groupOverallSettlements} />

            <h4 className="fund-balance-report__subheading">Payable now — shared funds and personal advances</h4>
            <GroupSettlementList
              emptyMessage="No current payment is required between the financial groups."
              settlements={report.groupPayableNowSettlements}
              onRecord={(settlement) => openSettlementPayment(settlement, "immediate")}
            />

            <h4 className="fund-balance-report__subheading">Shared fund settlement</h4>
            <GroupSettlementList
              emptyMessage="No shared fund settlement is required between the financial groups."
              settlements={report.groupSharedFundSettlements}
            />

            <h4 className="fund-balance-report__subheading">Personal purchases already paid</h4>
            <GroupSettlementList
              emptyMessage="No personal advance settlement is required between the financial groups."
              settlements={report.groupImmediateSettlements}
            />

            <h4 className="fund-balance-report__subheading">Afterpay commitment settlements between financial groups</h4>
            <GroupSettlementList
              emptyMessage="No Afterpay commitment payment is required between the financial groups."
              settlements={report.groupAfterpayCommitmentSettlements}
              onRecord={(settlement) => openSettlementPayment(settlement, "afterpay")}
            />

            <details className="fund-balance-report__individual-settlements">
              <summary>View individual accounting breakdown</summary>
              <h4 className="fund-balance-report__subheading">Final overall individual settlement</h4>
              <SettlementList
                emptyMessage="All individual positions are settled."
                settlements={report.overallSettlements}
                people={people}
              />

              <h4 className="fund-balance-report__subheading">Payable now — shared funds and personal advances</h4>
              <SettlementList
                emptyMessage="No current individual settlement is required."
                settlements={report.payableNowSettlements}
                people={people}
              />

              <h4 className="fund-balance-report__subheading">Personal bank or cash advances</h4>
              <SettlementList
                emptyMessage="No immediate personal settlement is required."
                settlements={report.immediateSettlements}
                people={people}
              />

              <h4 className="fund-balance-report__subheading">Afterpay commitments — not yet confirmed as paid</h4>
              <SettlementList
                emptyMessage="No Afterpay commitment settlement is required."
                settlements={report.afterpayCommitmentSettlements}
                people={people}
              />
            </details>
          </section>

          <section className="fund-balance-report__section" aria-labelledby="reconciliation-title">
            <h3 className="fund-balance-report__section-title" id="reconciliation-title">
              Shared fund reconciliation
            </h3>
            {report.reconciliations.length === 0 ? (
              <p className="fund-balance-report__empty-state">No physical balance check has been recorded.</p>
            ) : (
              <ul className="fund-balance-report__reconciliation-list">
                {report.reconciliations.map((reconciliation) => (
                  <li className="fund-balance-report__reconciliation" key={reconciliation.balanceCheckId}>
                    <strong>{reconciliation.sourceName}</strong> on {formatDate(reconciliation.checkedAt)}: expected{" "}
                    {formatCurrency(reconciliation.expectedBalance)}, counted {formatCurrency(reconciliation.countedBalance)}, difference{" "}
                    {formatCurrency(reconciliation.discrepancy)}.
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="fund-balance-report__explanation">
            <summary>How to explain this report</summary>
            <p>
              Shared funds compare what each member contributed with their responsibility for purchases paid by the household pool. Personal
              bank and cash payments show money one person advanced for everybody. Afterpay remains a future commitment until a confirmed
              payment amount is recorded.
            </p>
            <p>
              A positive position means that person or financial group should receive money. A negative position means they should pay.
              Payable now combines shared funds with personal advances already paid. Final overall position also includes every outstanding
              Afterpay commitment.
            </p>
          </details>

          <section
            className={`fund-balance-report__warnings ${report.warnings.length === 0 ? "fund-balance-report__warnings--clear" : ""}`}
            aria-labelledby="report-warnings-title"
          >
            <h3 id="report-warnings-title">Review data quality</h3>
            {report.warnings.length === 0 ? (
              <p>No data quality issues were detected in the current report.</p>
            ) : (
              <>
                <p>Review these items before relying on the settlement result.</p>
                <ul>
                  {report.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default FundBalanceReport;
