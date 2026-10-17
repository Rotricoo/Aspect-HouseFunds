import { Fragment, useMemo, useState } from "react";
import type { FinancialReport, FinancialSourceReport } from "../types/financial-report";
import { formatCurrency } from "../utils/formatters";
import type { Person } from "../types/person-id";
import { getPersonName } from "../utils/household-labels";

interface Props {
  report: FinancialReport;
  people: Person[];
}

function describePosition(amount: number): string {
  if (amount > 0) return `${formatCurrency(amount)} to receive`;
  if (amount < 0) return `${formatCurrency(Math.abs(amount))} to pay`;
  return "Settled";
}

function describeSourceMovement(source: FinancialSourceReport): string {
  if (source.expectedBalance !== null) return formatCurrency(source.netMovement);
  if (Math.abs(source.netMovement) < 0.005) return "No recorded movement";
  return `${formatCurrency(Math.abs(source.netMovement))} ${source.netMovement < 0 ? "paid out" : "received"}`;
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function FinancialAccountingTables({ report, people }: Props) {
  const [memberFilter, setMemberFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(new Set());

  const filteredMembers = useMemo(
    () => report.members.filter((member) => memberFilter === "all" || member.personId === memberFilter),
    [memberFilter, report.members],
  );
  const filteredSources = useMemo(
    () => report.sources.filter((source) => sourceFilter === "all" || source.sourceId === sourceFilter),
    [report.sources, sourceFilter],
  );
  const filteredGroups = useMemo(
    () => report.settlementGroups.filter((group) => groupFilter === "all" || group.groupId === groupFilter),
    [groupFilter, report.settlementGroups],
  );

  function toggleMember(memberId: string) {
    setExpandedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function exportMemberSummary() {
    const header = ["Member", "Responsible for", "Paid personally now", "Payable now", "Final overall position"];
    const rows = filteredMembers.map((member) => [
      getPersonName(member.personId, people),
      formatCurrency(member.totalResponsibility),
      formatCurrency(member.immediatePersonalPaid),
      describePosition(member.payableNowPosition),
      describePosition(member.overallPosition),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "household-member-summary.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="financial-accounting" aria-labelledby="financial-accounting-title">
      <div className="financial-accounting__heading">
        <div>
          <p>Readable first, detailed when needed</p>
          <h3 className="fund-balance-report__section-title" id="financial-accounting-title">
            Household accounting
          </h3>
        </div>
        <button type="button" className="financial-accounting__export" onClick={exportMemberSummary}>
          Export member summary CSV
        </button>
      </div>

      <div className="financial-accounting__filters" aria-label="Accounting filters">
        <label>
          <span>Member</span>
          <select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
            <option value="all">All members</option>
            {report.members.map((member) => (
              <option value={member.personId} key={member.personId}>
                {getPersonName(member.personId, people)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Payment source</span>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="all">All sources</option>
            {report.sources.map((source) => (
              <option value={source.sourceId} key={source.sourceId}>
                {source.sourceName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Settlement group</span>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="all">All groups</option>
            {report.settlementGroups.map((group) => (
              <option value={group.groupId} key={group.groupId}>
                {group.groupName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="fund-balance-report__section" aria-labelledby="financial-accounting-member-title">
        <div className="financial-accounting__section-heading">
          <div>
            <h4 className="fund-balance-report__section-title" id="financial-accounting-member-title">
              Member summary
            </h4>
            <p>Open a row to understand the numbers behind that member's final position.</p>
          </div>
          <span>
            {filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="fund-balance-report__table-wrapper">
          <table className="fund-balance-report__table financial-accounting__summary-table">
            <caption>Simple view of responsibility and settlement position</caption>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Responsible for</th>
                <th scope="col">Paid personally</th>
                <th scope="col">Payable now</th>
                <th scope="col">Final position</th>
                <th scope="col">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => {
                const isExpanded = expandedMemberIds.has(member.personId);
                return (
                  <Fragment key={member.personId}>
                    <tr key={member.personId}>
                      <th scope="row">{getPersonName(member.personId, people)}</th>
                      <td>{formatCurrency(member.totalResponsibility)}</td>
                      <td>{formatCurrency(member.immediatePersonalPaid)}</td>
                      <td>{describePosition(member.payableNowPosition)}</td>
                      <td>{describePosition(member.overallPosition)}</td>
                      <td>
                        <button
                          type="button"
                          className="financial-accounting__row-toggle"
                          aria-expanded={isExpanded}
                          onClick={() => toggleMember(member.personId)}
                        >
                          {isExpanded ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="financial-accounting__expanded-row">
                        <td colSpan={6}>
                          <dl>
                            <div>
                              <dt>Shared fund contribution</dt>
                              <dd>{formatCurrency(member.sharedFundContribution)}</dd>
                            </div>
                            <div>
                              <dt>Shared fund position</dt>
                              <dd>{describePosition(member.sharedFundPosition)}</dd>
                            </div>
                            <div>
                              <dt>Immediate responsibility</dt>
                              <dd>{formatCurrency(member.immediatePersonalResponsibility)}</dd>
                            </div>
                            <div>
                              <dt>Afterpay commitment</dt>
                              <dd>{formatCurrency(member.afterpayCommitted)}</dd>
                            </div>
                            <div>
                              <dt>Combined personal position</dt>
                              <dd>{describePosition(member.combinedPersonalPosition)}</dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <details className="fund-balance-report__records-group">
        <summary>Show detailed accounting tables</summary>
        <div className="fund-balance-report__records-stack">
          <section className="fund-balance-report__section" aria-labelledby="source-breakdown-title">
            <h4 className="fund-balance-report__section-title" id="source-breakdown-title">
              Money by payment source
            </h4>
            <div className="fund-balance-report__table-wrapper">
              <table className="fund-balance-report__table">
                <caption>Every shared and personal source kept separate for audit</caption>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Owner</th>
                    <th>Type</th>
                    <th>Contributions</th>
                    <th>Purchases</th>
                    <th>Afterpay paid</th>
                    <th>Refunds</th>
                    <th>Adjustments</th>
                    <th>Transfers in/out</th>
                    <th>Recorded movement</th>
                    <th>Tracked balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSources.map((source) => (
                    <tr key={source.sourceId}>
                      <th scope="row">{source.sourceName}</th>
                      <td>{source.ownership ?? "Not confirmed"}</td>
                      <td>{source.sourceType}</td>
                      <td>{formatCurrency(source.contributions)}</td>
                      <td>{formatCurrency(source.purchases)}</td>
                      <td>{formatCurrency(source.installmentPayments)}</td>
                      <td>{formatCurrency(source.refunds)}</td>
                      <td>{formatCurrency(source.adjustments)}</td>
                      <td>
                        {formatCurrency(source.transfersIn)} / {formatCurrency(source.transfersOut)}
                      </td>
                      <td>{describeSourceMovement(source)}</td>
                      <td>
                        {source.expectedBalance === null ? "Personal account balance not tracked" : formatCurrency(source.expectedBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="fund-balance-report__section" aria-labelledby="member-breakdown-title">
            <h4 className="fund-balance-report__section-title" id="member-breakdown-title">
              Full member accounting
            </h4>
            <div className="fund-balance-report__table-wrapper">
              <table className="fund-balance-report__table">
                <caption>Responsibility, personal advances and remaining claim in shared funds</caption>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Responsible for</th>
                    <th>Contributed to shared funds</th>
                    <th>Used from shared funds</th>
                    <th>Refund benefit</th>
                    <th>Position in shared funds</th>
                    <th>Paid personally now</th>
                    <th>Immediate responsibility</th>
                    <th>Immediate position</th>
                    <th>Afterpay commitment</th>
                    <th>Afterpay responsibility</th>
                    <th>Afterpay position</th>
                    <th>Combined personal position</th>
                    <th>Payable now including shared funds</th>
                    <th>Final overall position</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.personId}>
                      <th scope="row">{getPersonName(member.personId, people)}</th>
                      <td>{formatCurrency(member.totalResponsibility)}</td>
                      <td>{formatCurrency(member.sharedFundContribution)}</td>
                      <td>{formatCurrency(member.sharedFundResponsibility)}</td>
                      <td>{formatCurrency(member.sharedFundRefundBenefit)}</td>
                      <td>{formatCurrency(member.sharedFundPosition)}</td>
                      <td>{formatCurrency(member.immediatePersonalPaid)}</td>
                      <td>{formatCurrency(member.immediatePersonalResponsibility)}</td>
                      <td>{describePosition(member.immediatePosition)}</td>
                      <td>{formatCurrency(member.afterpayCommitted)}</td>
                      <td>{formatCurrency(member.afterpayResponsibility)}</td>
                      <td>{describePosition(member.afterpayPosition)}</td>
                      <td>{describePosition(member.combinedPersonalPosition)}</td>
                      <td>{describePosition(member.payableNowPosition)}</td>
                      <td>{describePosition(member.overallPosition)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="fund-balance-report__section" aria-labelledby="group-breakdown-title">
            <h4 className="fund-balance-report__section-title" id="group-breakdown-title">
              Financial group positions
            </h4>
            <div className="fund-balance-report__table-wrapper">
              <table className="fund-balance-report__table">
                <caption>Members remain individually auditable and can be combined through settlement groups</caption>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Members</th>
                    <th>Responsible for</th>
                    <th>Position in shared funds</th>
                    <th>Personal advances position</th>
                    <th>Payable now including shared funds</th>
                    <th>Afterpay position</th>
                    <th>Personal plus Afterpay</th>
                    <th>Final overall position</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => (
                    <tr key={group.groupId}>
                      <th scope="row">{group.groupName}</th>
                      <td>{group.memberPersonIds.map((personId) => getPersonName(personId, people)).join(", ")}</td>
                      <td>{formatCurrency(group.totalResponsibility)}</td>
                      <td>{formatCurrency(group.sharedFundPosition)}</td>
                      <td>{describePosition(group.immediatePosition)}</td>
                      <td>{describePosition(group.payableNowPosition)}</td>
                      <td>{describePosition(group.afterpayPosition)}</td>
                      <td>{describePosition(group.combinedPersonalPosition)}</td>
                      <td>{describePosition(group.overallPosition)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </details>
    </section>
  );
}
