import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";
import type { SettlementGroup } from "../types/settlement-group";
import type { Category } from "../types/category";
import { ApplicationError } from "../errors/application-error";

export function validatePerson(person: Person): void {
  if (!person.id.trim()) throw new ApplicationError("VALIDATION_ERROR", "A member ID is required.");
  if (!person.name.trim()) throw new ApplicationError("VALIDATION_ERROR", "Member name is required.");
  if (!Number.isFinite(person.weeklyContribution) || person.weeklyContribution < 0) {
    throw new ApplicationError("VALIDATION_ERROR", "Weekly contribution must be zero or greater.");
  }
}

export function validatePaymentSource(source: PaymentSource): void {
  if (!source.id.trim()) throw new ApplicationError("VALIDATION_ERROR", "A payment source ID is required.");
  if (!source.name.trim()) throw new ApplicationError("VALIDATION_ERROR", "Payment source name is required.");
  if (source.openingBalance !== null && (!Number.isFinite(source.openingBalance) || source.openingBalance < 0)) {
    throw new ApplicationError("VALIDATION_ERROR", "Opening balance must be zero or greater.");
  }
  if (source.type === "afterpay" && (!source.ownership || source.ownership === "household")) {
    throw new ApplicationError("INVALID_REFERENCE", "Pay-later sources must belong to a member.");
  }
}

export function validateSettlementGroup(group: SettlementGroup): void {
  if (!group.id.trim()) throw new ApplicationError("VALIDATION_ERROR", "A settlement group ID is required.");
  if (!group.name.trim()) throw new ApplicationError("VALIDATION_ERROR", "Settlement group name is required.");
  if (group.memberPersonIds.length === 0) throw new ApplicationError("VALIDATION_ERROR", "A settlement group needs at least one member.");
  if (new Set(group.memberPersonIds).size !== group.memberPersonIds.length) {
    throw new ApplicationError("VALIDATION_ERROR", "A settlement group cannot contain the same member twice.");
  }
}

export function validateCategory(category: Category): void {
  if (!category.id.trim()) throw new ApplicationError("VALIDATION_ERROR", "A category ID is required.");
  if (!category.name.trim()) throw new ApplicationError("VALIDATION_ERROR", "Category name is required.");
}
