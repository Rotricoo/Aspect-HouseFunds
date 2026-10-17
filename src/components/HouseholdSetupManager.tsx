import { useState } from "react";
import type { Person } from "../types/person-id";
import type { PaymentSource } from "../types/payment-source";
import type { SettlementGroup } from "../types/settlement-group";

interface Props {
  people: Person[];
  paymentSources: PaymentSource[];
  settlementGroups: SettlementGroup[];
  onSavePerson: (person: Person) => Promise<void>;
  onDeletePerson: (person: Person) => Promise<void>;
  onSaveSource: (source: PaymentSource) => Promise<void>;
  onDeleteSource: (source: PaymentSource) => Promise<void>;
  onSaveGroup: (group: SettlementGroup) => Promise<void>;
  onDeleteGroup: (group: SettlementGroup) => Promise<void>;
}

export default function HouseholdSetupManager(props: Props) {
  const [name, setName] = useState("");
  const [weeklyContribution, setWeeklyContribution] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<PaymentSource["type"]>("bank-account");
  const [sourceOwner, setSourceOwner] = useState<PaymentSource["ownership"]>("household");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  async function saveMember() {
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Member name is required.");
    const existing = props.people.find((person) => person.id === editingId);
    try {
      await props.onSavePerson({
        id: existing?.id ?? crypto.randomUUID(),
        name: trimmedName,
        weeklyContribution: Number(weeklyContribution) || 0,
        isActive: existing?.isActive ?? true,
      });
      setName("");
      setWeeklyContribution("0");
      setEditingId(null);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The member could not be saved.");
    }
  }

  function editMember(person: Person) {
    setEditingId(person.id);
    setName(person.name);
    setWeeklyContribution(String(person.weeklyContribution));
  }

  async function saveSource() {
    if (!sourceName.trim()) return setError("Payment source name is required.");
    const existing = props.paymentSources.find((source) => source.id === editingSourceId);
    try {
      await props.onSaveSource({
        id: existing?.id ?? crypto.randomUUID(),
        name: sourceName.trim(),
        type: sourceType,
        ownership: sourceOwner,
        managedBy: sourceOwner,
        openingBalance: existing?.openingBalance ?? null,
      });
      resetSourceForm();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The payment source could not be saved.");
    }
  }

  async function saveGroup() {
    if (!groupName.trim() || groupMembers.length === 0) return setError("Group name and at least one member are required.");
    try {
      await props.onSaveGroup({ id: editingGroupId ?? crypto.randomUUID(), name: groupName.trim(), memberPersonIds: groupMembers });
      resetGroupForm();
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The settlement group could not be saved.");
    }
  }

  function resetSourceForm() {
    setSourceName("");
    setSourceType("bank-account");
    setSourceOwner("household");
    setEditingSourceId(null);
  }

  function editSource(source: PaymentSource) {
    setEditingSourceId(source.id);
    setSourceName(source.name);
    setSourceType(source.type);
    setSourceOwner(source.ownership ?? "household");
  }

  function resetGroupForm() {
    setGroupName("");
    setGroupMembers([]);
    setEditingGroupId(null);
  }

  function editGroup(group: SettlementGroup) {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupMembers(group.memberPersonIds);
  }

  return (
    <details className="fund-balance-report__section household-setup-manager">
      <summary>
        <strong>Household setup</strong> · {props.people.filter((person) => person.isActive).length} active members
      </summary>
      <section aria-labelledby="members-title">
        <h3 id="members-title">Members</h3>
        <div className="household-setup-manager__form">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Member name" aria-label="Member name" />
          <input
            type="number"
            min="0"
            step="0.01"
            value={weeklyContribution}
            onChange={(event) => setWeeklyContribution(event.target.value)}
            aria-label="Weekly contribution"
          />
          <button type="button" onClick={() => void saveMember()}>
            {editingId ? "Save member" : "Add member"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setName("");
                setWeeklyContribution("0");
              }}
            >
              Cancel
            </button>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        <ul>
          {props.people.map((person) => (
            <li key={person.id}>
              {person.name} · {person.isActive ? "active" : "archived"}
              <button type="button" onClick={() => editMember(person)}>
                Edit
              </button>
              <button type="button" onClick={() => void props.onSavePerson({ ...person, isActive: !person.isActive })}>
                {person.isActive ? "Archive" : "Restore"}
              </button>
              <button type="button" onClick={() => void props.onDeletePerson(person)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="sources-title">
        <h3 id="sources-title">Payment sources</h3>
        <div className="household-setup-manager__form">
          <input
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="Source name"
            aria-label="Payment source name"
          />
          <select
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as PaymentSource["type"])}
            aria-label="Payment source type"
          >
            <option value="cash">Cash</option>
            <option value="bank-account">Bank account</option>
            <option value="afterpay">Afterpay</option>
          </select>
          <select
            value={sourceOwner ?? "household"}
            onChange={(event) => setSourceOwner(event.target.value)}
            aria-label="Payment source owner"
          >
            <option value="household">Household</option>
            {props.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void saveSource()}>
            {editingSourceId ? "Save source" : "Add source"}
          </button>
          {editingSourceId && (
            <button type="button" onClick={resetSourceForm}>
              Cancel
            </button>
          )}
        </div>
        <ul>
          {props.paymentSources.map((source) => (
            <li key={source.id}>
              {source.name} · {source.type}
              <button type="button" onClick={() => editSource(source)}>
                Edit
              </button>
              <button type="button" onClick={() => void props.onDeleteSource(source)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="groups-title">
        <h3 id="groups-title">Settlement groups</h3>
        <div className="household-setup-manager__form">
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Group name"
            aria-label="Settlement group name"
          />
          <button type="button" onClick={() => void saveGroup()}>
            {editingGroupId ? "Save group" : "Add group"}
          </button>
          {editingGroupId && (
            <button type="button" onClick={resetGroupForm}>
              Cancel
            </button>
          )}
        </div>
        <fieldset>
          <legend>Group members</legend>
          {props.people
            .filter((person) => person.isActive)
            .map((person) => (
              <label key={person.id}>
                <input
                  type="checkbox"
                  checked={groupMembers.includes(person.id)}
                  onChange={() =>
                    setGroupMembers((current) =>
                      current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id],
                    )
                  }
                />{" "}
                {person.name}
              </label>
            ))}
        </fieldset>
        <ul>
          {props.settlementGroups.map((group) => (
            <li key={group.id}>
              {group.name} · {group.memberPersonIds.length} members
              <button type="button" onClick={() => editGroup(group)}>
                Edit
              </button>
              <button type="button" onClick={() => void props.onDeleteGroup(group)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </details>
  );
}
