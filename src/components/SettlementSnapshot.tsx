import type { FundContribution } from "../types/fund-contribution";
import type { FinancialReport, SettlementGroupTransfer } from "../types/financial-report";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";
import type { SettlementGroup } from "../types/settlement-group";
import type { Person } from "../types/person-id";
import { formatCurrency, formatDate } from "../utils/formatters";
import { calculatePersonPurchaseShare } from "../utils/purchase-calculations";
import { getPersonName, getSharedSourceLabel } from "../utils/household-labels";

interface SettlementSnapshotProps {
  report: FinancialReport;
  purchases: Purchase[];
  contributions: FundContribution[];
  paymentSources: PaymentSource[];
  settlementGroups: SettlementGroup[];
  people: Person[];
}

function describe(transfer: SettlementGroupTransfer | undefined, empty: string): string {
  return transfer ? `${transfer.fromGroupName} pays ${transfer.toGroupName}` : empty;
}

function TransferLine({ label, transfer }: { label: string; transfer: SettlementGroupTransfer | undefined }) {
  return (
    <div className="settlement-snapshot__calculation-row">
      <span>{label}</span>
      <strong>{transfer ? formatCurrency(transfer.amount) : formatCurrency(0)}</strong>
      <p>{describe(transfer, "No transfer between groups")}</p>
    </div>
  );
}

export default function SettlementSnapshot({
  report,
  purchases,
  contributions,
  paymentSources,
  settlementGroups,
  people: _people,
}: SettlementSnapshotProps) {
  const shared = report.groupSharedFundSettlements[0];
  const immediate = report.groupImmediateSettlements[0];
  const payableNow = report.groupPayableNowSettlements[0];
  const afterpay = report.groupAfterpayCommitmentSettlements[0];
  const overall = report.groupOverallSettlements[0];
  const sourceById = new Map(paymentSources.map((source) => [source.id, source]));
  const groupByPersonId = new Map(settlementGroups.flatMap((group) => group.memberPersonIds.map((personId) => [personId, group] as const)));
  const recordedPurchases = purchases.filter((purchase) => purchase.date <= report.asOfDate);
  const recordedContributions = contributions.filter((contribution) => contribution.date === null || contribution.date <= report.asOfDate);

  return (
    <section className="settlement-snapshot" aria-labelledby="settlement-snapshot-title">
      <div className="settlement-snapshot__heading">
        <p>Quick answer for the household</p>
        <h3 id="settlement-snapshot-title">What needs to be settled?</h3>
        <span>The final position combines shared funds, personal advances and every recorded Afterpay commitment.</span>
      </div>

      <div className="settlement-snapshot__cards">
        <article className="settlement-snapshot__card--primary">
          <span>Final household position</span>
          <strong>{overall ? formatCurrency(overall.amount) : "All settled"}</strong>
          <p>{describe(overall, "No payment if every recorded commitment were settled")}</p>
        </article>
        <article>
          <span>Payable now</span>
          <strong>{payableNow ? formatCurrency(payableNow.amount) : "All settled"}</strong>
          <p>{describe(payableNow, "No current payment between groups")}</p>
        </article>
        <article>
          <span>Future Afterpay offset</span>
          <strong>{afterpay ? formatCurrency(afterpay.amount) : "All settled"}</strong>
          <p>{describe(afterpay, "No future Afterpay settlement")}</p>
        </article>
        <article>
          <span>Expected shared funds</span>
          <strong>{formatCurrency(report.summary.sharedFundsExpectedBalance)}</strong>
          <p>Money still held by {getSharedSourceLabel(paymentSources)}</p>
        </article>
      </div>

      <details className="settlement-snapshot__details">
        <summary>View calculation and transaction audit</summary>
        <div className="settlement-snapshot__calculation" aria-label="Settlement calculation by origin">
          <TransferLine label="Shared funds position" transfer={shared} />
          <TransferLine label="Personal purchases already paid" transfer={immediate} />
          <TransferLine label="Future Afterpay commitments" transfer={afterpay} />
          <TransferLine label="Final net settlement" transfer={overall} />
        </div>
        <p className="settlement-snapshot__note">
          Directions are netted against each other. Neutral cash corrections remain visible in reconciliation but do not create personal
          debt.
        </p>

        <details className="settlement-snapshot__ledger">
          <summary>Purchases included ({recordedPurchases.length})</summary>
          <div className="settlement-snapshot__table-wrapper">
            <table className="settlement-snapshot__table">
              <thead>
                <tr>
                  <th scope="col">Purchase</th>
                  <th scope="col">Date</th>
                  <th scope="col">Paid from</th>
                  {settlementGroups.map((group) => (
                    <th scope="col" key={group.id}>
                      {group.name} responsibility
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {recordedPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <th scope="row">{purchase.merchant}</th>
                    <td>{formatDate(purchase.date)}</td>
                    <td>{sourceById.get(purchase.paymentSourceId)?.name ?? purchase.paymentSourceId}</td>
                    {settlementGroups.map((group) => (
                      <td key={group.id}>
                        {formatCurrency(
                          group.memberPersonIds.reduce((total, personId) => total + calculatePersonPurchaseShare(personId, purchase), 0),
                        )}
                      </td>
                    ))}
                    <td>{formatCurrency(purchase.receiptTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="settlement-snapshot__ledger">
          <summary>Shared fund contributions ({recordedContributions.length})</summary>
          <ul className="settlement-snapshot__contributions">
            {recordedContributions.map((contribution) => (
              <li key={contribution.id}>
                <span>
                  {getPersonName(contribution.contributorPersonId, _people)} ·{" "}
                  {groupByPersonId.get(contribution.contributorPersonId)?.name ?? "Unknown group"}
                </span>
                <span>{sourceById.get(contribution.fundSourceId)?.name ?? contribution.fundSourceId}</span>
                <strong>{formatCurrency(contribution.amount)}</strong>
              </li>
            ))}
          </ul>
        </details>
      </details>
    </section>
  );
}
