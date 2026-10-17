import type { PaymentSource } from "../types/payment-source";
import type { Person, PersonId } from "../types/person-id";
import type { SettlementGroup } from "../types/settlement-group";
import { openHouseFundDatabase } from "./connection";
import type { Category } from "../types/category";
import { validateCategory, validatePaymentSource, validatePerson, validateSettlementGroup } from "./reference-data-validation";
import { ApplicationError } from "../errors/application-error";
import { countCategoryUsage, countPaymentSourceUsage, countPersonUsage, countSettlementGroupHistory } from "./reference-data-usage";

interface PaymentSourceRow {
  id: string;
  name: string;
  type: PaymentSource["type"];
  ownership: PaymentSource["ownership"];
  managed_by: PaymentSource["managedBy"];
  opening_balance_cents: number | null;
}

interface PersonRow {
  id: string;
  name: string;
  weekly_contribution_cents: number;
  is_active: number;
}

export interface ReferenceData {
  people: Person[];
  paymentSources: PaymentSource[];
  settlementGroups: SettlementGroup[];
  categories: Category[];
}

export async function loadReferenceData(): Promise<ReferenceData> {
  const database = await openHouseFundDatabase();
  const [personRows, sourceRows, groupRows, memberRows, categoryRows] = await Promise.all([
    database.select<PersonRow[]>("SELECT * FROM people ORDER BY name COLLATE NOCASE"),
    database.select<PaymentSourceRow[]>("SELECT * FROM payment_sources ORDER BY name"),
    database.select<Array<{ id: string; name: string }>>("SELECT * FROM settlement_groups ORDER BY name"),
    database.select<Array<{ settlement_group_id: string; person_id: PersonId }>>(
      "SELECT settlement_group_id, person_id FROM settlement_group_members ORDER BY settlement_group_id, person_id",
    ),
    database.select<Array<{ id: string; name: string; is_active: number }>>("SELECT * FROM categories ORDER BY name COLLATE NOCASE"),
  ]);

  return {
    people: personRows.map((row) => ({
      id: row.id,
      name: row.name,
      weeklyContribution: row.weekly_contribution_cents / 100,
      isActive: Boolean(row.is_active),
    })),
    paymentSources: sourceRows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      ownership: row.ownership,
      managedBy: row.managed_by,
      openingBalance: row.opening_balance_cents === null ? null : row.opening_balance_cents / 100,
    })),
    settlementGroups: groupRows.map((group) => ({
      ...group,
      memberPersonIds: memberRows.filter((member) => member.settlement_group_id === group.id).map((member) => member.person_id),
    })),
    categories: categoryRows.map((row) => ({ id: row.id, name: row.name, isActive: Boolean(row.is_active) })),
  };
}

export async function savePerson(person: Person): Promise<void> {
  validatePerson(person);
  const database = await openHouseFundDatabase();
  await database.execute(
    `INSERT INTO people (id, name, weekly_contribution_cents, is_active) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,
       weekly_contribution_cents=excluded.weekly_contribution_cents,
       is_active=excluded.is_active`,
    [person.id, person.name.trim(), Math.round(person.weeklyContribution * 100), person.isActive ? 1 : 0],
  );
}

export async function deletePerson(personId: PersonId): Promise<void> {
  const database = await openHouseFundDatabase();
  if ((await countPersonUsage(database, personId)) > 0) {
    throw new ApplicationError("REFERENCE_HAS_HISTORY", "This member has financial history. Archive the member instead of deleting them.");
  }
  await database.execute("DELETE FROM people WHERE id = ?", [personId]);
}

export async function savePaymentSource(source: PaymentSource): Promise<void> {
  validatePaymentSource(source);
  const database = await openHouseFundDatabase();
  const existing = await database.select<Array<Pick<PaymentSourceRow, "type" | "ownership" | "managed_by">>>(
    "SELECT type, ownership, managed_by FROM payment_sources WHERE id = ?",
    [source.id],
  );
  const current = existing[0];
  const hasSemanticChange =
    current && (current.type !== source.type || current.ownership !== source.ownership || current.managed_by !== source.managedBy);
  if (hasSemanticChange && (await countPaymentSourceUsage(database, source.id)) > 0) {
    throw new ApplicationError(
      "REFERENCE_HAS_HISTORY",
      "This payment source has history. Create a new source instead of changing its financial meaning.",
    );
  }
  await database.execute(
    `INSERT INTO payment_sources (id, name, type, ownership, managed_by, opening_balance_cents)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type,
       ownership=excluded.ownership, managed_by=excluded.managed_by,
       opening_balance_cents=excluded.opening_balance_cents`,
    [
      source.id,
      source.name.trim(),
      source.type,
      source.ownership,
      source.managedBy,
      source.openingBalance === null ? null : Math.round(source.openingBalance * 100),
    ],
  );
}

export async function deletePaymentSource(sourceId: string): Promise<void> {
  const database = await openHouseFundDatabase();
  if ((await countPaymentSourceUsage(database, sourceId)) > 0)
    throw new ApplicationError(
      "REFERENCE_HAS_HISTORY",
      "This payment source is already used. Keep it for historical records instead of deleting it.",
    );
  await database.execute("DELETE FROM payment_sources WHERE id = ?", [sourceId]);
}

export async function saveSettlementGroup(group: SettlementGroup): Promise<void> {
  validateSettlementGroup(group);
  const database = await openHouseFundDatabase();
  const existingMembers = await database.select<Array<{ person_id: PersonId }>>(
    "SELECT person_id FROM settlement_group_members WHERE settlement_group_id = ? ORDER BY person_id",
    [group.id],
  );
  const previousMemberIds = existingMembers.map((member) => member.person_id);
  const nextMemberIds = [...group.memberPersonIds].sort();
  const membershipChanged = previousMemberIds.join("|") !== nextMemberIds.join("|");
  if (membershipChanged) {
    if ((await countSettlementGroupHistory(database, group.id)) > 0) {
      throw new ApplicationError(
        "REFERENCE_HAS_SETTLEMENT_HISTORY",
        "This settlement group has historical settlements. Create a new group instead of changing its members.",
      );
    }
  }
  await database.execute("BEGIN");
  try {
    await database.execute("INSERT INTO settlement_groups (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name", [
      group.id,
      group.name.trim(),
    ]);
    await database.execute("DELETE FROM settlement_group_members WHERE settlement_group_id = ?", [group.id]);
    for (const personId of group.memberPersonIds) {
      await database.execute("INSERT INTO settlement_group_members (settlement_group_id, person_id) VALUES (?, ?)", [group.id, personId]);
    }
    await database.execute("COMMIT");
  } catch (error) {
    await database.execute("ROLLBACK");
    throw error;
  }
}

export async function deleteSettlementGroup(groupId: string): Promise<void> {
  const database = await openHouseFundDatabase();
  if ((await countSettlementGroupHistory(database, groupId)) > 0)
    throw new ApplicationError(
      "REFERENCE_HAS_SETTLEMENT_HISTORY",
      "This settlement group has historical records. Rename or update it instead of deleting it.",
    );
  await database.execute("DELETE FROM settlement_groups WHERE id = ?", [groupId]);
}

export async function saveCategory(category: Category): Promise<void> {
  validateCategory(category);
  const database = await openHouseFundDatabase();
  const existing = await database.select<Array<{ name: string }>>("SELECT name FROM categories WHERE id = ?", [category.id]);
  if (existing[0] && existing[0].name.localeCompare(category.name.trim(), undefined, { sensitivity: "accent" }) !== 0) {
    if ((await countCategoryUsage(database, category.id, existing[0].name)) > 0) {
      throw new ApplicationError(
        "REFERENCE_HAS_HISTORY",
        "This category has historical records. Deactivate it and create a new category instead of renaming it.",
      );
    }
  }
  await database.execute(
    `INSERT INTO categories (id, name, is_active) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=excluded.is_active`,
    [category.id, category.name, category.isActive ? 1 : 0],
  );
}

export async function deleteCategory(category: Category): Promise<void> {
  const database = await openHouseFundDatabase();
  if ((await countCategoryUsage(database, category.id, category.name)) > 0)
    throw new ApplicationError("REFERENCE_HAS_HISTORY", "This category is already used. Deactivate it instead of deleting it.");
  await database.execute("DELETE FROM categories WHERE id = ?", [category.id]);
}
