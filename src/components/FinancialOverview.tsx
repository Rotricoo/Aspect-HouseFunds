import { useMemo, useState } from "react";
import type { FinancialReport } from "../types/financial-report";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";
import { formatCurrency } from "../utils/formatters";

type OverviewScope = "general" | "home-setup" | "monthly";

interface FinancialOverviewProps {
  purchases: Purchase[];
  report: FinancialReport;
  paymentSources: PaymentSource[];
}

interface ScopedOverview {
  total: number;
  purchaseCount: number;
  itemCount: number;
  sharedFunds: number;
  personalFunds: number;
  afterpay: number;
}

const homeSetupCategories = new Set([
  "appliances",
  "bathroom",
  "bedroom",
  "cleaning",
  "decor",
  "delivery",
  "furniture",
  "home fragrance",
  "household",
  "household setup",
  "kitchen",
  "moving",
  "storage",
]);

const monthlyCategories = new Set(["electricity", "gas", "insurance", "internet", "rent", "subscription", "utilities", "utility", "water"]);

function calculateScopedOverview(purchases: Purchase[], categories: Set<string>, paymentSources: PaymentSource[]): ScopedOverview {
  const sourceById = new Map(paymentSources.map((source) => [source.id, source]));
  const matchingPurchaseIds = new Set<string>();
  let total = 0;
  let itemCount = 0;
  let sharedFunds = 0;
  let personalFunds = 0;
  let afterpay = 0;

  for (const purchase of purchases) {
    const source = sourceById.get(purchase.paymentSourceId);

    for (const item of purchase.items) {
      if (!categories.has(item.category.trim().toLowerCase())) {
        continue;
      }

      matchingPurchaseIds.add(purchase.id);
      total += item.totalAmount;
      itemCount += item.quantity;

      if (source?.type === "afterpay") {
        afterpay += item.totalAmount;
      } else if (source?.ownership === "household") {
        sharedFunds += item.totalAmount;
      } else {
        personalFunds += item.totalAmount;
      }
    }
  }

  return { total, purchaseCount: matchingPurchaseIds.size, itemCount, sharedFunds, personalFunds, afterpay };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="fund-balance-report__summary-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FinancialOverview({ purchases, report, paymentSources }: FinancialOverviewProps) {
  const [scope, setScope] = useState<OverviewScope>("general");
  const homeSetup = useMemo(() => calculateScopedOverview(purchases, homeSetupCategories, paymentSources), [paymentSources, purchases]);
  const monthly = useMemo(() => calculateScopedOverview(purchases, monthlyCategories, paymentSources), [paymentSources, purchases]);
  const scopedData = scope === "home-setup" ? homeSetup : monthly;

  return (
    <section className="fund-balance-report__section financial-overview" aria-labelledby="report-summary-title">
      <div className="financial-overview__heading">
        <div>
          <p>Choose the context before reading the numbers</p>
          <h3 className="fund-balance-report__section-title" id="report-summary-title">
            Overview
          </h3>
        </div>

        <div className="financial-overview__tabs" aria-label="Financial overview scope">
          <button
            className={scope === "general" ? "financial-overview__tab financial-overview__tab--active" : "financial-overview__tab"}
            onClick={() => setScope("general")}
            type="button"
            aria-pressed={scope === "general"}
          >
            General
          </button>
          <button
            className={scope === "home-setup" ? "financial-overview__tab financial-overview__tab--active" : "financial-overview__tab"}
            onClick={() => setScope("home-setup")}
            type="button"
            aria-pressed={scope === "home-setup"}
          >
            Home setup
          </button>
          <button
            className={scope === "monthly" ? "financial-overview__tab financial-overview__tab--active" : "financial-overview__tab"}
            onClick={() => setScope("monthly")}
            type="button"
            aria-pressed={scope === "monthly"}
          >
            Rent & bills
          </button>
        </div>
      </div>

      {scope === "general" ? (
        <dl className="fund-balance-report__summary">
          <Metric label="Gross purchases" value={formatCurrency(report.summary.grossPurchases)} />
          <Metric label="Refunds received" value={formatCurrency(report.summary.refundsReceived)} />
          <Metric label="Net recorded spending" value={formatCurrency(report.summary.netRecordedSpending)} />
          <Metric label="Expected money in shared funds" value={formatCurrency(report.summary.sharedFundsExpectedBalance)} />
          <Metric label="Advanced from personal cash/bank accounts" value={formatCurrency(report.summary.personallyAdvancedNow)} />
          <Metric label="Afterpay purchase commitments" value={formatCurrency(report.summary.afterpayCommitted)} />
        </dl>
      ) : (
        <>
          <p className="financial-overview__context">
            {scope === "home-setup"
              ? "One-off moving, furniture, appliance and household setup costs. This keeps the expensive move-in phase separate from normal life in the house."
              : "Recurring household costs such as rent, internet, electricity, water and other utilities. Rent will appear here as soon as its payment records are connected."}
          </p>
          <dl className="fund-balance-report__summary">
            <Metric
              label={scope === "home-setup" ? "Home setup spending" : "Rent and bills recorded"}
              value={formatCurrency(scopedData.total)}
            />
            <Metric label="Receipts included" value={String(scopedData.purchaseCount)} />
            <Metric label="Items or charges" value={String(scopedData.itemCount)} />
            <Metric label="Paid from shared funds" value={formatCurrency(scopedData.sharedFunds)} />
            <Metric label="Advanced personally" value={formatCurrency(scopedData.personalFunds)} />
            <Metric label="Afterpay commitments" value={formatCurrency(scopedData.afterpay)} />
          </dl>
        </>
      )}
    </section>
  );
}

export default FinancialOverview;
