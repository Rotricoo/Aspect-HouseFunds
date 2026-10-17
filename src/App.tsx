// React imports
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Types imports
// Component imports
import PurchasesView from "./components/PurchasesView";
import FundBalanceReport from "./components/FundBalanceReport";
import ActionCenter from "./components/ActionCenter";
import HouseholdOnboarding from "./components/HouseholdOnboarding";
import type { FinancialReportSection } from "./components/FundBalanceReport";

import { useHouseFundData } from "./hooks/use-housefund-data";
import { useFinancialActions } from "./hooks/use-financial-actions";
import { useRecurringActions } from "./hooks/use-recurring-actions";
import { usePersistenceFeedback } from "./hooks/use-persistence-feedback";
import { useHouseholdActions } from "./hooks/use-household-actions";
import { createCurrentFinancialReport } from "./utils/current-financial-report";
import { defaultAppSettings, loadAppSettings } from "./database/app-settings-repository";
import { DEMO_STORAGE_KEY } from "./demo/demo-data";

type AppView = "dashboard" | "purchases" | "financial-report";
const heroCollapseThreshold = 48;
const heroExpandThreshold = 12;
function App() {
  const isWebDemo = !("__TAURI_INTERNALS__" in window);
  const {
    purchases,
    setPurchases,
    fundContributions,
    setFundContributions,
    paymentInstallments,
    afterpayPayments,
    setAfterpayPayments,
    refunds,
    setRefunds,
    reimbursements,
    setReimbursements,
    fundTransfers,
    setFundTransfers,
    balanceChecks,
    setBalanceChecks,
    fundAdjustments,
    setFundAdjustments,
    movementCancellations,
    setMovementCancellations,
    recurringBills,
    setRecurringBills,
    recurringBillOccurrences,
    setRecurringBillOccurrences,
    recurringContributionPlans,
    recurringContributionOccurrences,
    setRecurringContributionOccurrences,
    availablePaymentSources,
    setAvailablePaymentSources,
    settlementGroups,
    setSettlementGroups,
    people,
    setPeople,
    categories,
    setCategories,
    isDatabaseLoading,
    databaseError,
    refreshRecurringData,
    refreshFinancialData,
  } = useHouseFundData();
  const {
    feedback: persistenceFeedback,
    setFeedback: setPersistenceFeedback,
    runPersistedOperation,
    persistInTauri,
  } = usePersistenceFeedback();

  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [purchaseFormRequest, setPurchaseFormRequest] = useState(0);
  const [financialReportInitialSection, setFinancialReportInitialSection] = useState<FinancialReportSection>("overview");
  const [isFinancialHeroCompact, setIsFinancialHeroCompact] = useState(false);
  const financialHeroCompactRef = useRef(false);
  const [purchasePageSize, setPurchasePageSize] = useState(defaultAppSettings.purchasePageSize);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    const refreshSettings = () => void loadAppSettings().then((settings) => setPurchasePageSize(settings.purchasePageSize));
    refreshSettings();
    window.addEventListener("housefund-settings-saved", refreshSettings);
    return () => window.removeEventListener("housefund-settings-saved", refreshSettings);
  }, []);

  const shouldShowOnboarding =
    !isDatabaseLoading && !databaseError && (people.length === 0 || availablePaymentSources.length === 0 || settlementGroups.length === 0);
  const currentFinancialReport = createCurrentFinancialReport({
    purchases,
    contributions: fundContributions,
    paymentInstallments,
    afterpayPayments,
    refunds,
    reimbursements,
    fundTransfers,
    balanceChecks,
    fundAdjustments,
    paymentSources: availablePaymentSources,
    settlementGroups,
    cancellations: movementCancellations,
    people,
  });

  function openFinancialSection(section: FinancialReportSection) {
    setFinancialReportInitialSection(section);
    setCurrentView("financial-report");
  }

  function resetWebDemo() {
    if (!isWebDemo || !window.confirm("Reset the fictional demo data?")) return;
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
    window.location.reload();
  }

  function openNewPurchaseFromDashboard() {
    setCurrentView("purchases");
    setPurchaseFormRequest((request) => request + 1);
  }

  function handleAppContentScroll(scrollTop: number) {
    if (currentView !== "financial-report") {
      return;
    }

    const shouldBeCompact = financialHeroCompactRef.current ? scrollTop > heroExpandThreshold : scrollTop > heroCollapseThreshold;

    if (shouldBeCompact === financialHeroCompactRef.current) {
      return;
    }

    financialHeroCompactRef.current = shouldBeCompact;
    setIsFinancialHeroCompact(shouldBeCompact);
  }

  const {
    handleContributionSave,
    handleCategorySave,
    handleCategoryDelete,
    handleAfterpayPaymentSave,
    handleAfterpayPaymentDelete,
    handleRefundSave,
    handleReimbursementSave,
    handleTransferSave,
    handleBalanceCheckSave,
    handleAdjustmentSave,
    handleMovementCancellationChange,
    handleMovementDelete,
  } = useFinancialActions({
    fundContributions,
    setFundContributions,
    recurringContributionPlans,
    recurringContributionOccurrences,
    setCategories,
    setAfterpayPayments,
    setRefunds,
    setReimbursements,
    setFundTransfers,
    setBalanceChecks,
    setFundAdjustments,
    setMovementCancellations,
    persist: persistInTauri,
  });

  const { saveMember, deleteMember, saveSource, deleteSource, saveGroup, deleteGroup } = useHouseholdActions({
    setPeople,
    setPaymentSources: setAvailablePaymentSources,
    setSettlementGroups,
    persist: persistInTauri,
  });

  const {
    handleRecurringBillOccurrenceSave,
    handleRecurringContributionOccurrenceSave,
    handleRecurringContributionPlanSave,
    handleRecurringContributionPlanDelete,
    handleRecurringBillSave,
    handleRecurringBillDelete,
  } = useRecurringActions({
    setPurchases,
    setRecurringBills,
    setRecurringBillOccurrences,
    setRecurringContributionOccurrences,
    refreshRecurringData,
    refreshFinancialData,
    persist: runPersistedOperation,
  });

  useLayoutEffect(() => {
    document.querySelector<HTMLElement>(".app__content")?.scrollTo({ top: 0, behavior: "auto" });

    if (currentView === "purchases") {
      return;
    } else if (currentView === "financial-report") {
      financialHeroCompactRef.current = false;
      setIsFinancialHeroCompact(false);
    } else {
      financialHeroCompactRef.current = false;
      setIsFinancialHeroCompact(false);
    }
  }, [currentView]);

  return (
    <main className={`app app--${currentView}`}>
      {isWebDemo && (
        <aside className="app__demo-banner" role="status">
          <strong>Web demo</strong>
          <span>Fictional data only. Changes are saved locally in this browser, not to SQLite.</span>
          <code>Download the desktop app for the full local-first experience.</code>
          <button type="button" onClick={resetWebDemo}>
            Reset demo
          </button>
        </aside>
      )}
      {isDatabaseLoading && (
        <div className="app__database-state" role="status">
          <strong>Loading Aspect - House Funds…</strong>
          <span>Reading your household records from SQLite.</span>
        </div>
      )}
      {databaseError && (
        <div className="app__database-state app__database-state--error" role="alert">
          <strong>Aspect - House Funds could not load the database.</strong>
          <span>{databaseError}</span>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}
      {persistenceFeedback && (
        <div
          className={`app__save-feedback app__save-feedback--${persistenceFeedback.status}`}
          role={persistenceFeedback.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <span className="app__save-feedback-dot" aria-hidden="true" />
          <span>{persistenceFeedback.message}</span>
          {persistenceFeedback.status === "error" && (
            <button type="button" onClick={() => setPersistenceFeedback(null)} aria-label="Dismiss save error">
              ×
            </button>
          )}
        </div>
      )}
      <header className="app__header">
        <div className="app__brand">
          <span className="app__brand-mark" aria-hidden="true">
            HF
          </span>
          <div>
            <p className="app__eyebrow">Aspect</p>
            <h1 className="app__title">House Funds</h1>
          </div>
        </div>

        <nav className="app-navigation" aria-label="Main navigation">
          <button
            className={`app-navigation__button ${currentView === "dashboard" ? "app-navigation__button--active" : ""}`}
            onClick={() => setCurrentView("dashboard")}
            type="button"
            aria-pressed={currentView === "dashboard"}
          >
            Home
          </button>
          <button
            className={`app-navigation__button ${currentView === "purchases" ? "app-navigation__button--active" : ""}`}
            onClick={() => setCurrentView("purchases")}
            type="button"
            aria-pressed={currentView === "purchases"}
          >
            Purchases
          </button>
          <button
            className={`app-navigation__button ${currentView === "financial-report" ? "app-navigation__button--active" : ""}`}
            onClick={() => setCurrentView("financial-report")}
            type="button"
            aria-pressed={currentView === "financial-report"}
          >
            Financial Report
          </button>
        </nav>
      </header>

      <div className="app__content" onScroll={(event) => handleAppContentScroll(event.currentTarget.scrollTop)}>
        {shouldShowOnboarding && (
          <HouseholdOnboarding
            people={people}
            paymentSources={availablePaymentSources}
            settlementGroups={settlementGroups}
            onSavePerson={saveMember}
            onSaveSource={saveSource}
            onSaveGroup={saveGroup}
            onComplete={() => setCurrentView("dashboard")}
          />
        )}
        {currentView === "dashboard" && (
          <ActionCenter
            report={currentFinancialReport}
            purchases={purchases}
            recurringBills={recurringBills}
            recurringBillOccurrences={recurringBillOccurrences}
            recurringContributionPlans={recurringContributionPlans}
            recurringContributionOccurrences={recurringContributionOccurrences}
            paymentSources={availablePaymentSources}
            people={people}
            onNewPurchase={openNewPurchaseFromDashboard}
            onOpenFinancialSection={openFinancialSection}
          />
        )}
        {currentView === "purchases" && (
          <PurchasesView
            purchases={purchases}
            setPurchases={setPurchases}
            categories={categories}
            people={people}
            paymentSources={availablePaymentSources}
            pageSize={purchasePageSize}
            openFormRequest={purchaseFormRequest}
            persistInTauri={persistInTauri}
          />
        )}

        {currentView === "financial-report" && (
          <FundBalanceReport
            initialSection={financialReportInitialSection}
            purchases={purchases}
            contributions={fundContributions}
            paymentInstallments={paymentInstallments}
            afterpayPayments={afterpayPayments}
            refunds={refunds}
            reimbursements={reimbursements}
            fundTransfers={fundTransfers}
            balanceChecks={balanceChecks}
            fundAdjustments={fundAdjustments}
            recurringBills={recurringBills}
            recurringBillOccurrences={recurringBillOccurrences}
            recurringContributionPlans={recurringContributionPlans}
            recurringContributionOccurrences={recurringContributionOccurrences}
            paymentSources={availablePaymentSources}
            people={people}
            settlementGroups={settlementGroups}
            cancellations={movementCancellations}
            categories={categories}
            isHeroCompact={isFinancialHeroCompact}
            onContributionAdd={handleContributionSave}
            onAfterpayPaymentSave={handleAfterpayPaymentSave}
            onAfterpayPaymentDelete={handleAfterpayPaymentDelete}
            onRefundAdd={handleRefundSave}
            onReimbursementAdd={handleReimbursementSave}
            onFundTransferAdd={handleTransferSave}
            onBalanceCheckAdd={handleBalanceCheckSave}
            onFundAdjustmentAdd={handleAdjustmentSave}
            onRecurringBillOccurrenceSave={handleRecurringBillOccurrenceSave}
            onRecurringBillSave={handleRecurringBillSave}
            onRecurringBillDelete={handleRecurringBillDelete}
            onRecurringContributionOccurrenceSave={handleRecurringContributionOccurrenceSave}
            onRecurringContributionPlanSave={handleRecurringContributionPlanSave}
            onRecurringContributionPlanDelete={handleRecurringContributionPlanDelete}
            onMovementCancellationChange={handleMovementCancellationChange}
            onMovementDelete={handleMovementDelete}
            onCategorySave={handleCategorySave}
            onCategoryDelete={handleCategoryDelete}
            onSavePerson={saveMember}
            onDeletePerson={deleteMember}
            onSaveSource={saveSource}
            onDeleteSource={deleteSource}
            onSaveGroup={saveGroup}
            onDeleteGroup={deleteGroup}
          />
        )}
      </div>
    </main>
  );
}

export default App;
