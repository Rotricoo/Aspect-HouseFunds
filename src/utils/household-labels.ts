import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";

export function getPersonName(personId: string, people: Person[], fallback = "Unknown member"): string {
  return people.find((person) => person.id === personId)?.name ?? fallback;
}

export function formatPersonNames(personIds: string[], people: Person[], empty = "No members selected"): string {
  const names = personIds.map((personId) => getPersonName(personId, people));
  return names.length > 0 ? names.join(", ") : empty;
}

export function getSharedSourceLabel(paymentSources: PaymentSource[]): string {
  const sharedSources = paymentSources.filter((source) => source.ownership === "household");
  if (sharedSources.length === 0) return "shared household sources";
  return sharedSources.map((source) => source.name).join(" and ");
}
