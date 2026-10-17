import type { Dispatch, SetStateAction } from "react";
import {
  deletePaymentSource,
  deletePerson,
  deleteSettlementGroup,
  savePaymentSource,
  savePerson,
  saveSettlementGroup,
} from "../database/reference-data-repository";
import type { Person } from "../types/person-id";
import type { PaymentSource } from "../types/payment-source";
import type { SettlementGroup } from "../types/settlement-group";

interface Props {
  setPeople: Dispatch<SetStateAction<Person[]>>;
  setPaymentSources: Dispatch<SetStateAction<PaymentSource[]>>;
  setSettlementGroups: Dispatch<SetStateAction<SettlementGroup[]>>;
  persist: (operation: () => Promise<void>, message?: string) => Promise<void>;
}

export function useHouseholdActions({ setPeople, setPaymentSources, setSettlementGroups, persist }: Props) {
  async function saveMember(person: Person) {
    await persist(() => savePerson(person), "Saving member");
    setPeople((current) => [...current.filter((item) => item.id !== person.id), person].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function deleteMember(person: Person) {
    if (!window.confirm(`Delete member "${person.name}"?`)) return;
    await persist(() => deletePerson(person.id), "Deleting member");
    setPeople((current) => current.filter((item) => item.id !== person.id));
  }

  async function saveSource(source: PaymentSource) {
    await persist(() => savePaymentSource(source), "Saving payment source");
    setPaymentSources((current) =>
      [...current.filter((item) => item.id !== source.id), source].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function deleteSource(source: PaymentSource) {
    if (!window.confirm(`Delete payment source "${source.name}"?`)) return;
    await persist(() => deletePaymentSource(source.id), "Deleting payment source");
    setPaymentSources((current) => current.filter((item) => item.id !== source.id));
  }

  async function saveGroup(group: SettlementGroup) {
    await persist(() => saveSettlementGroup(group), "Saving settlement group");
    setSettlementGroups((current) =>
      [...current.filter((item) => item.id !== group.id), group].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function deleteGroup(group: SettlementGroup) {
    if (!window.confirm(`Delete settlement group "${group.name}"?`)) return;
    await persist(() => deleteSettlementGroup(group.id), "Deleting settlement group");
    setSettlementGroups((current) => current.filter((item) => item.id !== group.id));
  }

  return { saveMember, deleteMember, saveSource, deleteSource, saveGroup, deleteGroup };
}
