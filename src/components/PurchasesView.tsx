import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Purchase } from "../types/purchase";
import PurchaseDetails from "./PurchaseDetails";
import PurchaseList from "./PurchaseList";
import NewPurchaseForm from "./NewPurchaseForm";
import PurchaseFilters from "./PurchaseFilters";
import type { Category } from "../types/category";
import type { Person } from "../types/person-id";
import type { PaymentSource } from "../types/payment-source";
import { deletePurchase, savePurchase } from "../database/recurring-bill-repository";
import { usePurchaseFilters } from "../hooks/use-purchase-filters";

interface PurchasesViewProps {
  purchases: Purchase[];
  setPurchases: Dispatch<SetStateAction<Purchase[]>>;
  categories: Category[];
  people: Person[];
  paymentSources: PaymentSource[];
  pageSize: number;
  openFormRequest: number;
  persistInTauri: (operation: () => Promise<void>, message?: string) => Promise<void>;
}

const interfaceExitAnimationDuration = 180;
const heroCollapseThreshold = 48;
const heroExpandThreshold = 12;

export default function PurchasesView({
  purchases,
  setPurchases,
  categories,
  people,
  paymentSources,
  pageSize,
  openFormRequest,
  persistInTauri,
}: PurchasesViewProps) {
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [purchaseBeingEdited, setPurchaseBeingEdited] = useState<Purchase | null>(null);
  const [isNewPurchaseFormOpen, setIsNewPurchaseFormOpen] = useState(false);
  const [isPurchaseDetailsClosing, setIsPurchaseDetailsClosing] = useState(false);
  const [isPurchaseFormClosing, setIsPurchaseFormClosing] = useState(false);
  const [isHeroCompact, setIsHeroCompact] = useState(false);
  const heroCompactRef = useRef(false);
  const purchaseFilters = usePurchaseFilters(purchases, pageSize);
  const hasActiveFilters = Boolean(
    purchaseFilters.period !== "all" ||
    purchaseFilters.merchant.trim() ||
    purchaseFilters.startDate ||
    purchaseFilters.endDate ||
    purchaseFilters.paymentSourceId,
  );

  const activeCategoryNames = categories.filter((category) => category.isActive).map((category) => category.name);

  useEffect(() => {
    if (selectedPurchase && !purchaseFilters.filteredPurchases.some((purchase) => purchase.id === selectedPurchase.id)) {
      setSelectedPurchase(null);
      setIsPurchaseDetailsClosing(false);
    }
  }, [purchaseFilters.filteredPurchases, selectedPurchase]);

  useEffect(() => {
    if (openFormRequest === 0) return;
    setIsPurchaseFormClosing(false);
    setIsNewPurchaseFormOpen(true);
  }, [openFormRequest]);

  useEffect(() => {
    const isPurchaseFormVisible = isNewPurchaseFormOpen || Boolean(purchaseBeingEdited);
    if (!isPurchaseFormVisible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isNewPurchaseFormOpen, purchaseBeingEdited]);

  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || isNewPurchaseFormOpen || purchaseBeingEdited || !selectedPurchase) return;
      handlePurchaseDetailsClose();
    }

    window.addEventListener("keydown", handleEscapeKey);
    return () => window.removeEventListener("keydown", handleEscapeKey);
  });

  async function handlePurchaseDelete(purchaseId: string) {
    const purchaseToDelete = purchases.find((purchase) => purchase.id === purchaseId);
    if (!purchaseToDelete || !window.confirm(`Delete "${purchaseToDelete.merchant}"?`)) return;

    await persistInTauri(() => deletePurchase(purchaseId));
    setPurchases((currentPurchases) => currentPurchases.filter((purchase) => purchase.id !== purchaseId));
    setSelectedPurchase(null);
  }

  async function handleNewPurchase(newPurchase: Purchase) {
    await persistInTauri(() => savePurchase(newPurchase));
    setPurchases((currentPurchases) => [...currentPurchases, newPurchase]);
    setIsNewPurchaseFormOpen(false);
    setIsPurchaseFormClosing(false);
  }

  async function handlePurchaseUpdate(updatedPurchase: Purchase) {
    await persistInTauri(() => savePurchase(updatedPurchase));
    setPurchases((currentPurchases) =>
      currentPurchases.map((purchase) => (purchase.id === updatedPurchase.id ? updatedPurchase : purchase)),
    );
    setPurchaseBeingEdited(null);
    setIsPurchaseFormClosing(false);
    setSelectedPurchase(updatedPurchase);
  }

  function handlePurchaseDetailsClose() {
    if (isPurchaseDetailsClosing) return;
    setIsPurchaseDetailsClosing(true);
    window.setTimeout(() => {
      setSelectedPurchase(null);
      setIsPurchaseDetailsClosing(false);
    }, interfaceExitAnimationDuration);
  }

  function handlePurchaseFormClose() {
    if (isPurchaseFormClosing) return;
    setIsPurchaseFormClosing(true);
    window.setTimeout(() => {
      setIsNewPurchaseFormOpen(false);
      setPurchaseBeingEdited(null);
      setIsPurchaseFormClosing(false);
    }, interfaceExitAnimationDuration);
  }

  function handlePurchaseListScroll(scrollTop: number) {
    const shouldBeCompact = heroCompactRef.current ? scrollTop > heroExpandThreshold : scrollTop > heroCollapseThreshold;
    if (shouldBeCompact === heroCompactRef.current) return;
    heroCompactRef.current = shouldBeCompact;
    setIsHeroCompact(shouldBeCompact);
  }

  return (
    <section className="purchases-view" aria-labelledby="purchases-view-title">
      <header className={`page-hero page-hero--purchases purchases-view__hero ${isHeroCompact ? "page-hero--compact" : ""}`}>
        <div className="page-hero__content">
          <p className="page-hero__eyebrow purchases-view__eyebrow">Household activity</p>
          <div className="page-hero__summary">
            <h2 className="page-hero__title purchases-view__title" id="purchases-view-title">
              Purchases
            </h2>
            <p className="page-hero__description purchases-view__count">{purchases.length} recorded transactions</p>
          </div>
        </div>
        <button
          className="page-hero__action purchases-view__new-purchase"
          onClick={() => {
            setIsPurchaseFormClosing(false);
            setIsNewPurchaseFormOpen(true);
          }}
          type="button"
        >
          <span aria-hidden="true">+</span> New Purchase
        </button>
      </header>

      <PurchaseFilters
        purchases={purchases}
        paymentSources={paymentSources}
        period={purchaseFilters.period}
        merchant={purchaseFilters.merchant}
        startDate={purchaseFilters.startDate}
        endDate={purchaseFilters.endDate}
        paymentSourceId={purchaseFilters.paymentSourceId}
        sortOrder={purchaseFilters.sortOrder}
        matchedCount={purchaseFilters.filteredPurchases.length}
        visibleCount={purchaseFilters.visiblePurchases.length}
        onPeriodChange={purchaseFilters.setPeriod}
        onMerchantChange={purchaseFilters.setMerchant}
        onStartDateChange={purchaseFilters.setStartDate}
        onEndDateChange={purchaseFilters.setEndDate}
        onPaymentSourceChange={purchaseFilters.setPaymentSourceId}
        onSortOrderChange={purchaseFilters.setSortOrder}
        onClear={purchaseFilters.clear}
      />

      {(isNewPurchaseFormOpen || purchaseBeingEdited) && (
        <NewPurchaseForm
          isClosing={isPurchaseFormClosing}
          merchantOptions={purchaseFilters.merchantOptions}
          purchaseToEdit={purchaseBeingEdited ?? undefined}
          paymentSources={paymentSources}
          categories={activeCategoryNames}
          people={people}
          onClose={handlePurchaseFormClose}
          onSubmit={purchaseBeingEdited ? handlePurchaseUpdate : handleNewPurchase}
        />
      )}

      <div className={`purchases-view__layout ${selectedPurchase ? "purchases-view__layout--with-details" : ""}`}>
        <div className="purchases-view__list-panel">
          <PurchaseList
            onPurchaseSelect={(purchase) => {
              setIsPurchaseDetailsClosing(false);
              setSelectedPurchase(purchase);
            }}
            onScrollPositionChange={handlePurchaseListScroll}
            purchases={purchaseFilters.visiblePurchases}
            totalCount={purchases.length}
            hasActiveFilters={hasActiveFilters}
            hasMore={purchaseFilters.visiblePurchases.length < purchaseFilters.filteredPurchases.length}
            onLoadMore={purchaseFilters.loadMore}
            onCreatePurchase={() => {
              setIsPurchaseFormClosing(false);
              setIsNewPurchaseFormOpen(true);
            }}
            onClearFilters={purchaseFilters.clear}
          />
        </div>

        {selectedPurchase && (
          <aside
            className={`purchases-view__detail-panel ${isPurchaseDetailsClosing ? "purchases-view__detail-panel--closing" : ""}`}
            aria-label="Selected purchase details"
          >
            <PurchaseDetails
              purchase={selectedPurchase}
              paymentSources={paymentSources}
              people={people}
              onClose={handlePurchaseDetailsClose}
              onEdit={() => {
                setSelectedPurchase(null);
                setIsPurchaseDetailsClosing(false);
                setIsPurchaseFormClosing(false);
                setPurchaseBeingEdited(selectedPurchase);
              }}
            />
            <button className="purchases-view__delete-purchase" onClick={() => handlePurchaseDelete(selectedPurchase.id)} type="button">
              Delete Purchase
            </button>
          </aside>
        )}
      </div>
    </section>
  );
}
