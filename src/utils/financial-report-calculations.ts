import type { FundAdjustment } from "../types/fund-adjustment";
import type { AfterpayPayment } from "../types/afterpay-payment";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundContribution } from "../types/fund-contribution";
import type { FundTransfer } from "../types/fund-transfer";
import type {
  FinancialReport,
  FinancialSourceReport,
  FundReconciliationReport,
  MemberFinancialReport,
  SettlementGroupFinancialReport,
  SettlementGroupTransfer,
  SettlementTransfer,
} from "../types/financial-report";
import type { PaymentSource } from "../types/payment-source";
import type { PaymentInstallment } from "../types/payment-installment";
import type { PersonId } from "../types/person-id";
import type { Purchase } from "../types/purchase";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";
import type { SettlementGroup } from "../types/settlement-group";
import { calculateEqualSplit, calculatePersonPurchaseShare, isReceiptValid } from "./purchase-calculations";
import { addMoney, fromMoneyCents, subtractMoney, sumMoney, toMoneyCents } from "./money";
import { formatDateOnly } from "./date-only";

interface GenerateFinancialReportInput {
  purchases: Purchase[];
  contributions: FundContribution[];
  refunds: Refund[];
  adjustments: FundAdjustment[];
  balanceChecks: FundBalanceCheck[];
  reimbursements: Reimbursement[];
  fundTransfers: FundTransfer[];
  paymentSources: PaymentSource[];
  paymentInstallments: PaymentInstallment[];
  afterpayPayments: AfterpayPayment[];
  asOfDate: Date;
  settlementGroups: SettlementGroup[];
  personIds?: PersonId[];
}

interface MutableMemberReport extends MemberFinancialReport {
  immediateReimbursementAdjustment: number;
  afterpayReimbursementAdjustment: number;
}

interface AppliedAfterpayPayment {
  id: string;
  amount: number;
  paidFromPaymentSourceId: string;
}

function roundMoney(amount: number): number {
  return fromMoneyCents(toMoneyCents(amount));
}

function allocateProportionally(
  memberShares: Map<PersonId, number>,
  allocatedAmount: number,
  totalAmount: number,
  personIds: PersonId[],
): Map<PersonId, number> {
  const allocatedCents = Math.round(allocatedAmount * 100);
  let remainingCents = allocatedCents;
  const result = new Map<PersonId, number>();

  personIds.forEach((personId, index) => {
    const isLastPerson = index === personIds.length - 1;
    const shareCents = isLastPerson
      ? remainingCents
      : Math.min(remainingCents, Math.round(((memberShares.get(personId) ?? 0) / totalAmount) * allocatedCents));
    result.set(personId, shareCents / 100);
    remainingCents -= shareCents;
  });

  return result;
}

function isOnOrBefore(date: Date | null, asOfDate: Date): boolean {
  return date === null || formatDateOnly(date) <= formatDateOnly(asOfDate);
}

function isPersonId(value: string | null): value is PersonId {
  return typeof value === "string" && value.trim().length > 0;
}

function createEmptyMemberReport(personId: PersonId): MutableMemberReport {
  return {
    personId,
    totalResponsibility: 0,
    sharedFundContribution: 0,
    sharedFundResponsibility: 0,
    sharedFundRefundBenefit: 0,
    sharedFundPosition: 0,
    immediatePersonalPaid: 0,
    immediatePersonalResponsibility: 0,
    immediatePosition: 0,
    afterpayCommitted: 0,
    afterpayResponsibility: 0,
    afterpayPosition: 0,
    combinedPersonalPosition: 0,
    payableNowPosition: 0,
    overallPosition: 0,
    immediateReimbursementAdjustment: 0,
    afterpayReimbursementAdjustment: 0,
  };
}

function calculateSignedAdjustments(adjustments: FundAdjustment[]): number {
  return sumMoney(adjustments, (adjustment) => (adjustment.direction === "increase" ? adjustment.amount : -adjustment.amount));
}

function createSourceReport(source: PaymentSource, input: GenerateFinancialReportInput, asOfDate: Date): FinancialSourceReport {
  const contributions = input.contributions.filter(
    (contribution) => contribution.fundSourceId === source.id && isOnOrBefore(contribution.date, asOfDate),
  );
  const purchases = input.purchases.filter((purchase) => purchase.paymentSourceId === source.id && isOnOrBefore(purchase.date, asOfDate));
  const refunds = input.refunds.filter((refund) => refund.receivedToPaymentSourceId === source.id && isOnOrBefore(refund.date, asOfDate));
  const adjustments = input.adjustments.filter(
    (adjustment) => adjustment.fundSourceId === source.id && isOnOrBefore(adjustment.date, asOfDate),
  );
  const transfersIn = input.fundTransfers.filter(
    (transfer) => transfer.toPaymentSourceId === source.id && isOnOrBefore(transfer.date, asOfDate),
  );
  const transfersOut = input.fundTransfers.filter(
    (transfer) => transfer.fromPaymentSourceId === source.id && isOnOrBefore(transfer.date, asOfDate),
  );
  const paidInstallments = input.paymentInstallments.filter(
    (installment) =>
      installment.status === "paid" &&
      installment.paidFromPaymentSourceId === source.id &&
      installment.paidDate !== null &&
      isOnOrBefore(installment.paidDate, asOfDate),
  );
  const afterpayPayments = input.afterpayPayments.filter(
    (payment) => payment.paidFromPaymentSourceId === source.id && isOnOrBefore(payment.date, asOfDate),
  );

  const contributionTotal = sumMoney(contributions, (contribution) => contribution.amount);
  const purchaseTotal = sumMoney(purchases, (purchase) => purchase.receiptTotal);
  const refundTotal = sumMoney(refunds, (refund) => refund.amount);
  const adjustmentTotal = calculateSignedAdjustments(adjustments);
  const transferInTotal = sumMoney(transfersIn, (transfer) => transfer.amount);
  const transferOutTotal = sumMoney(transfersOut, (transfer) => transfer.amount);
  const installmentPaymentTotal = addMoney(
    sumMoney(paidInstallments, (installment) => installment.amount),
    sumMoney(afterpayPayments, (payment) => payment.amount),
  );

  // Current House Cash contributions already explain its opening balance. The
  // openingBalance field is only a fallback for a household source without contribution records.
  const openingFunds = contributionTotal > 0 ? contributionTotal : (source.openingBalance ?? 0);
  const netMovement = subtractMoney(
    addMoney(contributionTotal, refundTotal, adjustmentTotal, transferInTotal),
    purchaseTotal,
    installmentPaymentTotal,
    transferOutTotal,
  );
  const expectedBalance =
    source.ownership === "household"
      ? subtractMoney(
          addMoney(openingFunds, refundTotal, adjustmentTotal, transferInTotal),
          purchaseTotal,
          installmentPaymentTotal,
          transferOutTotal,
        )
      : null;

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    ownership: source.ownership,
    contributions: roundMoney(contributionTotal),
    purchases: roundMoney(purchaseTotal),
    installmentPayments: roundMoney(installmentPaymentTotal),
    refunds: roundMoney(refundTotal),
    adjustments: roundMoney(adjustmentTotal),
    transfersIn: roundMoney(transferInTotal),
    transfersOut: roundMoney(transferOutTotal),
    netMovement: roundMoney(netMovement),
    expectedBalance: expectedBalance === null ? null : roundMoney(expectedBalance),
  };
}

function createSettlementTransfers(positions: Map<PersonId, number>, personIds: PersonId[]): SettlementTransfer[] {
  const creditors = personIds
    .map((personId) => ({ personId, cents: Math.round((positions.get(personId) ?? 0) * 100) }))
    .filter((position) => position.cents > 0);
  const debtors = personIds
    .map((personId) => ({ personId, cents: Math.round((positions.get(personId) ?? 0) * 100) }))
    .filter((position) => position.cents < 0)
    .map((position) => ({ ...position, cents: Math.abs(position.cents) }));

  const settlements: SettlementTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const settlementCents = Math.min(debtor.cents, creditor.cents);

    if (settlementCents > 0) {
      settlements.push({
        fromPersonId: debtor.personId,
        toPersonId: creditor.personId,
        amount: settlementCents / 100,
      });
    }

    debtor.cents -= settlementCents;
    creditor.cents -= settlementCents;

    if (debtor.cents === 0) {
      debtorIndex++;
    }
    if (creditor.cents === 0) {
      creditorIndex++;
    }
  }

  return settlements;
}

function createSettlementGroupReports(
  settlementGroups: SettlementGroup[],
  memberReports: MemberFinancialReport[],
): SettlementGroupFinancialReport[] {
  return settlementGroups.map((group) => {
    const groupMembers = memberReports.filter((member) => group.memberPersonIds.includes(member.personId));

    const sumMemberField = (field: keyof MemberFinancialReport): number =>
      sumMoney(groupMembers, (member) => {
        const value = member[field];
        return typeof value === "number" ? value : 0;
      });

    return {
      groupId: group.id,
      groupName: group.name,
      memberPersonIds: group.memberPersonIds,
      totalResponsibility: roundMoney(sumMemberField("totalResponsibility")),
      sharedFundPosition: roundMoney(sumMemberField("sharedFundPosition")),
      immediatePosition: roundMoney(sumMemberField("immediatePosition")),
      afterpayPosition: roundMoney(sumMemberField("afterpayPosition")),
      combinedPersonalPosition: roundMoney(sumMemberField("combinedPersonalPosition")),
      payableNowPosition: roundMoney(sumMemberField("payableNowPosition")),
      overallPosition: roundMoney(sumMemberField("overallPosition")),
    };
  });
}

type SettlementGroupPositionField =
  "sharedFundPosition" | "immediatePosition" | "payableNowPosition" | "afterpayPosition" | "combinedPersonalPosition" | "overallPosition";

function createSettlementGroupTransfers(
  groupReports: SettlementGroupFinancialReport[],
  positionField: SettlementGroupPositionField,
): SettlementGroupTransfer[] {
  const creditors = groupReports
    .map((group) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      cents: Math.round(group[positionField] * 100),
    }))
    .filter((position) => position.cents > 0);
  const debtors = groupReports
    .map((group) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      cents: Math.round(group[positionField] * 100),
    }))
    .filter((position) => position.cents < 0)
    .map((position) => ({ ...position, cents: Math.abs(position.cents) }));

  const settlements: SettlementGroupTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const settlementCents = Math.min(debtor.cents, creditor.cents);

    if (settlementCents > 0) {
      settlements.push({
        fromGroupId: debtor.groupId,
        fromGroupName: debtor.groupName,
        toGroupId: creditor.groupId,
        toGroupName: creditor.groupName,
        amount: settlementCents / 100,
      });
    }

    debtor.cents -= settlementCents;
    creditor.cents -= settlementCents;

    if (debtor.cents === 0) {
      debtorIndex++;
    }
    if (creditor.cents === 0) {
      creditorIndex++;
    }
  }

  return settlements;
}

export function generateFinancialReport(input: GenerateFinancialReportInput): FinancialReport {
  const personIds = input.personIds ?? [...new Set(input.settlementGroups.flatMap((group) => group.memberPersonIds))];
  const warnings = new Set<string>();
  const sourceById = new Map(input.paymentSources.map((source) => [source.id, source]));
  const purchaseById = new Map(input.purchases.map((purchase) => [purchase.id, purchase]));
  const members = new Map<PersonId, MutableMemberReport>(personIds.map((personId) => [personId, createEmptyMemberReport(personId)]));
  function memberFor(personId: PersonId, context: string): MutableMemberReport | null {
    const member = members.get(personId);
    if (!member) {
      warnings.add(`${context} references unknown member ${personId}.`);
      return null;
    }
    return member;
  }

  const purchases = input.purchases.filter((purchase) => isOnOrBefore(purchase.date, input.asOfDate));
  const refunds = input.refunds.filter((refund) => isOnOrBefore(refund.date, input.asOfDate));
  const reimbursements = input.reimbursements.filter((reimbursement) => isOnOrBefore(reimbursement.date, input.asOfDate));
  const appliedAfterpayPaymentsByPurchaseId = new Map<string, AppliedAfterpayPayment[]>();

  const settlementMembership = new Map<PersonId, number>(personIds.map((personId) => [personId, 0]));
  for (const group of input.settlementGroups) {
    for (const personId of group.memberPersonIds) {
      settlementMembership.set(personId, (settlementMembership.get(personId) ?? 0) + 1);
    }
  }
  for (const [personId, membershipCount] of settlementMembership) {
    if (membershipCount !== 1) warnings.add(`${personId} must belong to exactly one settlement group; found ${membershipCount}.`);
  }

  for (const purchase of input.purchases) {
    const purchaseInstallments = input.paymentInstallments.filter((installment) => installment.purchaseId === purchase.id);
    if (purchaseInstallments.length === 0) continue;
    const installmentTotal = sumMoney(purchaseInstallments, (installment) => installment.amount);
    if (Math.abs(installmentTotal - purchase.receiptTotal) >= 0.01) {
      warnings.add(`Instalments for ${purchase.merchant} total ${installmentTotal}, but the purchase total is ${purchase.receiptTotal}.`);
    }
    for (const installment of purchaseInstallments) {
      if (installment.status === "paid" && (!installment.paidDate || !installment.paidFromPaymentSourceId)) {
        warnings.add(`Paid instalment ${installment.id} is missing its paid date or payment source.`);
      }
      if (installment.status !== "paid" && (installment.paidDate || installment.paidFromPaymentSourceId)) {
        warnings.add(`Unpaid instalment ${installment.id} still contains payment details.`);
      }
    }
  }

  for (const installment of input.paymentInstallments) {
    if (installment.status !== "paid" || installment.paidDate === null || !isOnOrBefore(installment.paidDate, input.asOfDate)) {
      continue;
    }
    appliedAfterpayPaymentsByPurchaseId.set(installment.purchaseId, [
      ...(appliedAfterpayPaymentsByPurchaseId.get(installment.purchaseId) ?? []),
      {
        id: installment.id,
        amount: installment.amount,
        paidFromPaymentSourceId: installment.paidFromPaymentSourceId!,
      },
    ]);
  }

  for (const source of input.paymentSources.filter((paymentSource) => paymentSource.type === "afterpay")) {
    const sourcePurchases = purchases
      .filter((purchase) => purchase.paymentSourceId === source.id)
      .sort((first, second) => first.date.getTime() - second.date.getTime() || first.id.localeCompare(second.id));
    const remainingCentsByPurchaseId = new Map<string, number>(
      sourcePurchases.map((purchase) => {
        const legacyPaidCents = toMoneyCents(
          sumMoney(appliedAfterpayPaymentsByPurchaseId.get(purchase.id) ?? [], (payment) => payment.amount),
        );
        return [purchase.id, Math.max(0, toMoneyCents(purchase.receiptTotal) - legacyPaidCents)] as const;
      }),
    );

    const sourcePayments = input.afterpayPayments
      .filter((payment) => payment.afterpaySourceId === source.id && isOnOrBefore(payment.date, input.asOfDate))
      .sort((first, second) => first.date.getTime() - second.date.getTime() || first.id.localeCompare(second.id));

    for (const payment of sourcePayments) {
      let paymentCents: number = toMoneyCents(payment.amount);
      const totalRemainingCents = [...remainingCentsByPurchaseId.values()].reduce((total, amount) => total + amount, 0);
      if (paymentCents > totalRemainingCents) {
        warnings.add(
          `Afterpay payment ${payment.id} exceeds the remaining commitment by ${fromMoneyCents(paymentCents - totalRemainingCents)}.`,
        );
        paymentCents = totalRemainingCents;
      }
      if (paymentCents <= 0 || totalRemainingCents <= 0) continue;

      let centsLeftToAllocate = paymentCents;
      const purchasesWithBalance = sourcePurchases.filter((purchase) => (remainingCentsByPurchaseId.get(purchase.id) ?? 0) > 0);
      purchasesWithBalance.forEach((purchase, index) => {
        const remainingForPurchase = remainingCentsByPurchaseId.get(purchase.id) ?? 0;
        const isLast = index === purchasesWithBalance.length - 1;
        const allocatedCents = isLast
          ? Math.min(remainingForPurchase, centsLeftToAllocate)
          : Math.min(remainingForPurchase, Math.round((remainingForPurchase / totalRemainingCents) * paymentCents));
        if (allocatedCents <= 0) return;
        appliedAfterpayPaymentsByPurchaseId.set(purchase.id, [
          ...(appliedAfterpayPaymentsByPurchaseId.get(purchase.id) ?? []),
          {
            id: payment.id,
            amount: fromMoneyCents(allocatedCents),
            paidFromPaymentSourceId: payment.paidFromPaymentSourceId,
          },
        ]);
        remainingCentsByPurchaseId.set(purchase.id, remainingForPurchase - allocatedCents);
        centsLeftToAllocate -= allocatedCents;
      });
    }
  }

  for (const contribution of input.contributions) {
    if (!isOnOrBefore(contribution.date, input.asOfDate)) {
      continue;
    }
    const contributor = members.get(contribution.contributorPersonId);
    if (contributor) {
      contributor.sharedFundContribution += contribution.amount;
    }
  }

  for (const purchase of purchases) {
    const source = sourceById.get(purchase.paymentSourceId);
    const memberShares = new Map<PersonId, number>();

    if (!isReceiptValid(purchase)) {
      warnings.add(`Purchase ${purchase.id} does not match its receipt total.`);
    }

    for (const personId of personIds) {
      const share = calculatePersonPurchaseShare(personId, purchase);
      memberShares.set(personId, share);
      const member = memberFor(personId, `Purchase ${purchase.id}`);
      if (member) member.totalResponsibility += share;
    }

    const allocatedTotal = personIds.reduce((total, personId) => total + (memberShares.get(personId) ?? 0), 0);
    if (Math.abs(allocatedTotal - purchase.receiptTotal) >= 0.01) {
      warnings.add(`Purchase ${purchase.id} has ${roundMoney(purchase.receiptTotal - allocatedTotal)} not allocated to a member.`);
    }

    if (!source) {
      warnings.add(`Purchase ${purchase.id} uses unknown payment source ${purchase.paymentSourceId}.`);
      continue;
    }

    if (source.ownership === "household") {
      for (const personId of personIds) {
        const member = memberFor(personId, `Purchase ${purchase.id}`);
        if (member) member.sharedFundResponsibility += memberShares.get(personId) ?? 0;
      }
      continue;
    }

    if (!isPersonId(source.ownership)) {
      warnings.add(`Payment source ${source.id} does not identify a personal owner.`);
      continue;
    }

    const sourceOwner = memberFor(source.ownership, `Payment source ${source.id}`);
    if (!sourceOwner) continue;
    if (source.type === "afterpay") {
      const appliedPayments = appliedAfterpayPaymentsByPurchaseId.get(purchase.id) ?? [];
      const paidAmount = Math.min(
        appliedPayments.reduce((total, payment) => total + payment.amount, 0),
        purchase.receiptTotal,
      );
      sourceOwner.afterpayCommitted += purchase.receiptTotal - paidAmount;

      const paidResponsibilityByPerson = new Map<PersonId, number>(personIds.map((personId) => [personId, 0]));
      for (const payment of appliedPayments) {
        const payerSource = sourceById.get(payment.paidFromPaymentSourceId);
        const paymentShares = allocateProportionally(memberShares, payment.amount, purchase.receiptTotal, personIds);

        if (!payerSource) {
          warnings.add(`Afterpay payment ${payment.id} does not identify a valid payment source.`);
          continue;
        }

        if (payerSource.ownership === "household") {
          for (const personId of personIds) {
            const paidShare = paymentShares.get(personId) ?? 0;
            const member = memberFor(personId, `Afterpay payment ${payment.id}`);
            if (member) member.sharedFundResponsibility += paidShare;
            paidResponsibilityByPerson.set(personId, (paidResponsibilityByPerson.get(personId) ?? 0) + paidShare);
          }
        } else if (isPersonId(payerSource.ownership)) {
          const payer = memberFor(payerSource.ownership, `Payment source ${payerSource.id}`);
          if (!payer) continue;
          payer.immediatePersonalPaid += payment.amount;
          for (const personId of personIds) {
            const paidShare = paymentShares.get(personId) ?? 0;
            const member = memberFor(personId, `Afterpay payment ${payment.id}`);
            if (member) member.immediatePersonalResponsibility += paidShare;
            paidResponsibilityByPerson.set(personId, (paidResponsibilityByPerson.get(personId) ?? 0) + paidShare);
          }
        } else {
          warnings.add(`Payment source ${payerSource.id} does not identify who funded Afterpay payment ${payment.id}.`);
        }
      }

      for (const personId of personIds) {
        const member = memberFor(personId, `Afterpay purchase ${purchase.id}`);
        if (member) {
          member.afterpayResponsibility += Math.max(0, (memberShares.get(personId) ?? 0) - (paidResponsibilityByPerson.get(personId) ?? 0));
        }
      }
    } else {
      sourceOwner.immediatePersonalPaid += purchase.receiptTotal;
      for (const personId of personIds) {
        const member = memberFor(personId, `Purchase ${purchase.id}`);
        if (member) member.immediatePersonalResponsibility += memberShares.get(personId) ?? 0;
      }
    }
  }

  for (const refund of refunds) {
    const destinationSource = sourceById.get(refund.receivedToPaymentSourceId);
    const originalPurchase = purchaseById.get(refund.originalPurchaseId);
    const benefitShares = calculateEqualSplit(refund.amount, refund.beneficiaryPersonIds);

    if (!destinationSource) {
      warnings.add(`Refund ${refund.id} uses unknown destination ${refund.receivedToPaymentSourceId}.`);
      continue;
    }
    if (!originalPurchase) {
      warnings.add(`Refund ${refund.id} is not linked to a known purchase.`);
    } else if (originalPurchase.paymentSourceId !== refund.receivedToPaymentSourceId) {
      warnings.add(`Refund ${refund.id} returned to a different source than the original purchase; review its settlement manually.`);
    }

    for (const beneficiaryId of refund.beneficiaryPersonIds) {
      if (!isPersonId(beneficiaryId)) {
        warnings.add(`Refund ${refund.id} contains unknown beneficiary ${beneficiaryId}.`);
        continue;
      }
      const benefit = benefitShares[beneficiaryId] ?? 0;
      const member = memberFor(beneficiaryId, `Refund ${refund.id}`);
      if (!member) continue;
      member.totalResponsibility -= benefit;

      if (destinationSource.ownership === "household") {
        member.sharedFundResponsibility -= benefit;
        member.sharedFundRefundBenefit += benefit;
      } else if (destinationSource.type === "afterpay") {
        member.afterpayResponsibility -= benefit;
      } else {
        member.immediatePersonalResponsibility -= benefit;
      }
    }

    if (isPersonId(destinationSource.ownership)) {
      const destinationOwner = memberFor(destinationSource.ownership, `Refund ${refund.id}`);
      if (!destinationOwner) continue;
      if (destinationSource.type === "afterpay") {
        destinationOwner.afterpayCommitted -= refund.amount;
      } else {
        destinationOwner.immediatePersonalPaid -= refund.amount;
      }
    }
  }

  for (const reimbursement of reimbursements) {
    const fromMember = memberFor(reimbursement.fromPersonId, `Reimbursement ${reimbursement.id}`);
    const toMember = memberFor(reimbursement.toPersonId, `Reimbursement ${reimbursement.id}`);
    if (!fromMember || !toMember) continue;

    if (reimbursement.appliesTo === "afterpay") {
      fromMember.afterpayReimbursementAdjustment += reimbursement.amount;
      toMember.afterpayReimbursementAdjustment -= reimbursement.amount;
    } else {
      fromMember.immediateReimbursementAdjustment += reimbursement.amount;
      toMember.immediateReimbursementAdjustment -= reimbursement.amount;
    }
  }

  for (const adjustment of input.adjustments) {
    if (!isOnOrBefore(adjustment.date, input.asOfDate) || adjustment.allocationKind === "balance-only") continue;
    if (adjustment.splitBetweenPersonIds.length === 0) {
      warnings.add(`Fund adjustment ${adjustment.id} is an allocated household expense without members.`);
      continue;
    }
    const signedResponsibility = adjustment.direction === "decrease" ? adjustment.amount : -adjustment.amount;
    const shares = calculateEqualSplit(signedResponsibility, adjustment.splitBetweenPersonIds);
    for (const personId of adjustment.splitBetweenPersonIds) {
      const share = shares[personId] ?? 0;
      const member = memberFor(personId, `Fund adjustment ${adjustment.id}`);
      if (member) {
        member.totalResponsibility += share;
        member.sharedFundResponsibility += share;
      }
    }
  }

  const memberReports = personIds.map((personId): MemberFinancialReport => {
    const member = members.get(personId)!;
    const sharedFundPosition = subtractMoney(member.sharedFundContribution, member.sharedFundResponsibility);
    const immediatePosition = addMoney(
      subtractMoney(member.immediatePersonalPaid, member.immediatePersonalResponsibility),
      member.immediateReimbursementAdjustment,
    );
    const afterpayPosition = addMoney(
      subtractMoney(member.afterpayCommitted, member.afterpayResponsibility),
      member.afterpayReimbursementAdjustment,
    );
    const payableNowPosition = addMoney(sharedFundPosition, immediatePosition);
    const overallPosition = addMoney(payableNowPosition, afterpayPosition);

    return {
      personId,
      totalResponsibility: roundMoney(member.totalResponsibility),
      sharedFundContribution: roundMoney(member.sharedFundContribution),
      sharedFundResponsibility: roundMoney(member.sharedFundResponsibility),
      sharedFundRefundBenefit: roundMoney(member.sharedFundRefundBenefit),
      sharedFundPosition: roundMoney(sharedFundPosition),
      immediatePersonalPaid: roundMoney(member.immediatePersonalPaid),
      immediatePersonalResponsibility: roundMoney(member.immediatePersonalResponsibility),
      immediatePosition: roundMoney(immediatePosition),
      afterpayCommitted: roundMoney(member.afterpayCommitted),
      afterpayResponsibility: roundMoney(member.afterpayResponsibility),
      afterpayPosition: roundMoney(afterpayPosition),
      combinedPersonalPosition: roundMoney(immediatePosition + afterpayPosition),
      payableNowPosition: roundMoney(payableNowPosition),
      overallPosition: roundMoney(overallPosition),
    };
  });

  const sources = input.paymentSources.map((source) => createSourceReport(source, input, input.asOfDate));
  const immediatePositions = new Map(memberReports.map((member) => [member.personId, member.immediatePosition]));
  const sharedFundPositions = new Map(memberReports.map((member) => [member.personId, member.sharedFundPosition]));
  const payableNowPositions = new Map(memberReports.map((member) => [member.personId, member.payableNowPosition]));
  const afterpayPositions = new Map(memberReports.map((member) => [member.personId, member.afterpayPosition]));
  const combinedPositions = new Map(memberReports.map((member) => [member.personId, member.combinedPersonalPosition]));
  const overallPositions = new Map(memberReports.map((member) => [member.personId, member.overallPosition]));
  const settlementGroupReports = createSettlementGroupReports(input.settlementGroups, memberReports);

  const latestChecksBySource = new Map<string, FundBalanceCheck>();
  for (const check of input.balanceChecks) {
    if (!isOnOrBefore(check.checkedAt, input.asOfDate)) {
      continue;
    }
    const current = latestChecksBySource.get(check.fundSourceId);
    if (!current || current.checkedAt < check.checkedAt) {
      latestChecksBySource.set(check.fundSourceId, check);
    }
  }

  const reconciliations: FundReconciliationReport[] = [];
  for (const check of latestChecksBySource.values()) {
    const source = sourceById.get(check.fundSourceId);
    if (!source) {
      warnings.add(`Balance check ${check.id} uses unknown source ${check.fundSourceId}.`);
      continue;
    }
    const expectedBalance = createSourceReport(source, input, check.checkedAt).expectedBalance;
    if (expectedBalance === null) {
      warnings.add(`Balance check ${check.id} belongs to a personal source whose private balance is not tracked.`);
      continue;
    }
    reconciliations.push({
      balanceCheckId: check.id,
      sourceId: source.id,
      sourceName: source.name,
      checkedAt: check.checkedAt,
      expectedBalance,
      countedBalance: check.countedAmount,
      discrepancy: roundMoney(check.countedAmount - expectedBalance),
      notes: check.notes,
    });
  }

  const grossPurchases = sumMoney(purchases, (purchase) => purchase.receiptTotal);
  const refundsReceived = sumMoney(refunds, (refund) => refund.amount);
  const sharedFundsExpectedBalance = sumMoney(sources, (source) => source.expectedBalance ?? 0);
  const personallyAdvancedNow = sumMoney(memberReports, (member) => member.immediatePersonalPaid);
  const afterpayCommitted = sumMoney(memberReports, (member) => member.afterpayCommitted);
  const immediatePositionTotal = sumMoney(memberReports, (member) => member.immediatePosition);
  const afterpayPositionTotal = sumMoney(memberReports, (member) => member.afterpayPosition);
  if (Math.abs(immediatePositionTotal) >= 0.01)
    warnings.add(`Immediate personal positions are out of balance by ${immediatePositionTotal}.`);
  if (Math.abs(afterpayPositionTotal) >= 0.01) warnings.add(`Afterpay positions are out of balance by ${afterpayPositionTotal}.`);

  return {
    asOfDate: input.asOfDate,
    summary: {
      grossPurchases: roundMoney(grossPurchases),
      refundsReceived: roundMoney(refundsReceived),
      netRecordedSpending: subtractMoney(grossPurchases, refundsReceived),
      sharedFundsExpectedBalance: roundMoney(sharedFundsExpectedBalance),
      personallyAdvancedNow: roundMoney(personallyAdvancedNow),
      afterpayCommitted: roundMoney(afterpayCommitted),
    },
    sources,
    members: memberReports,
    settlementGroups: settlementGroupReports,
    groupSharedFundSettlements: createSettlementGroupTransfers(settlementGroupReports, "sharedFundPosition"),
    groupImmediateSettlements: createSettlementGroupTransfers(settlementGroupReports, "immediatePosition"),
    groupPayableNowSettlements: createSettlementGroupTransfers(settlementGroupReports, "payableNowPosition"),
    groupAfterpayCommitmentSettlements: createSettlementGroupTransfers(settlementGroupReports, "afterpayPosition"),
    groupCombinedPersonalSettlements: createSettlementGroupTransfers(settlementGroupReports, "combinedPersonalPosition"),
    groupOverallSettlements: createSettlementGroupTransfers(settlementGroupReports, "overallPosition"),
    sharedFundSettlements: createSettlementTransfers(sharedFundPositions, personIds),
    immediateSettlements: createSettlementTransfers(immediatePositions, personIds),
    payableNowSettlements: createSettlementTransfers(payableNowPositions, personIds),
    afterpayCommitmentSettlements: createSettlementTransfers(afterpayPositions, personIds),
    combinedPersonalSettlements: createSettlementTransfers(combinedPositions, personIds),
    overallSettlements: createSettlementTransfers(overallPositions, personIds),
    reconciliations,
    warnings: [...warnings],
  };
}
