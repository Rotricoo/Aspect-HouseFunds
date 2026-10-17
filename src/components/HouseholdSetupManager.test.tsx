import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HouseholdSetupManager from "./HouseholdSetupManager";

const people = [{ id: "person-1", name: "Demo Member", weeklyContribution: 25, isActive: true }];

describe("HouseholdSetupManager", () => {
  afterEach(cleanup);

  it("adds a member and clears the form after saving", async () => {
    const onSavePerson = vi.fn().mockResolvedValue(undefined);
    render(
      <HouseholdSetupManager
        people={people}
        paymentSources={[]}
        settlementGroups={[]}
        onSavePerson={onSavePerson}
        onDeletePerson={vi.fn()}
        onSaveSource={vi.fn()}
        onDeleteSource={vi.fn()}
        onSaveGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Household setup"));
    fireEvent.change(screen.getByLabelText("Member name"), { target: { value: "Second Member" } });
    fireEvent.change(screen.getByLabelText("Weekly contribution"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));

    await waitFor(() => expect(onSavePerson).toHaveBeenCalledOnce());
    expect(onSavePerson.mock.calls[0][0]).toMatchObject({ name: "Second Member", weeklyContribution: 40, isActive: true });
    expect(screen.getByLabelText("Member name")).toHaveValue("");
  });

  it("shows validation feedback when a settlement group has no members", async () => {
    render(
      <HouseholdSetupManager
        people={people}
        paymentSources={[]}
        settlementGroups={[]}
        onSavePerson={vi.fn()}
        onDeletePerson={vi.fn()}
        onSaveSource={vi.fn()}
        onDeleteSource={vi.fn()}
        onSaveGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Household setup"));
    fireEvent.change(screen.getByLabelText("Settlement group name"), { target: { value: "Demo Group" } });
    fireEvent.click(screen.getByRole("button", { name: "Add group" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Group name and at least one member are required.");
  });
});
