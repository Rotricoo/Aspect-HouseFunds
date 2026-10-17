import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HouseholdOnboarding from "./HouseholdOnboarding";

describe("HouseholdOnboarding", () => {
  afterEach(cleanup);

  const emptySetup = {
    people: [],
    paymentSources: [],
    settlementGroups: [],
  };

  it("requires the member name before continuing", async () => {
    render(
      <HouseholdOnboarding {...emptySetup} onSavePerson={vi.fn()} onSaveSource={vi.fn()} onSaveGroup={vi.fn()} onComplete={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Add a member name to continue.");
  });

  it("shows onboarding progress and keeps keyboard focus inside the dialog", () => {
    render(
      <HouseholdOnboarding {...emptySetup} onSavePerson={vi.fn()} onSaveSource={vi.fn()} onSaveGroup={vi.fn()} onComplete={vi.fn()} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(screen.getByLabelText("Onboarding progress")).toBeInTheDocument();
    expect(screen.getByLabelText("Onboarding progress").querySelector('[aria-current="step"]')).toHaveTextContent("Household basics");

    const continueButton = screen.getByRole("button", { name: "Continue" });
    continueButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(document.activeElement).toBe(continueButton);
    fireEvent.click(continueButton);
    expect(screen.getByLabelText("Onboarding progress").querySelector('[aria-current="step"]')).toHaveTextContent("Members");
    expect(screen.getByPlaceholderText("e.g. Alex")).toHaveFocus();
  });

  it("creates the missing member, source, and settlement group", async () => {
    const onSavePerson = vi.fn().mockResolvedValue(undefined);
    const onSaveSource = vi.fn().mockResolvedValue(undefined);
    const onSaveGroup = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <HouseholdOnboarding
        {...emptySetup}
        onSavePerson={onSavePerson}
        onSaveSource={onSaveSource}
        onSaveGroup={onSaveGroup}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Alex"), { target: { value: "Demo Member" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Shared account"), { target: { value: "Demo Account" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Household"), { target: { value: "Demo Household" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create household" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onSavePerson).toHaveBeenCalledOnce();
    expect(onSavePerson.mock.calls[0][0]).toMatchObject({ name: "Demo Member", isActive: true });
    expect(onSaveSource.mock.calls[0][0]).toMatchObject({ name: "Demo Account", type: "bank-account" });
    expect(onSaveGroup.mock.calls[0][0]).toMatchObject({ name: "Demo Household" });
  });

  it("completes partial setup without duplicating existing data", async () => {
    const onSavePerson = vi.fn().mockResolvedValue(undefined);
    const onSaveSource = vi.fn().mockResolvedValue(undefined);
    const onSaveGroup = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <HouseholdOnboarding
        people={[{ id: "person-1", name: "Existing Member", weeklyContribution: 0, isActive: true }]}
        paymentSources={[]}
        settlementGroups={[]}
        onSavePerson={onSavePerson}
        onSaveSource={onSaveSource}
        onSaveGroup={onSaveGroup}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Shared account"), { target: { value: "Demo Account" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Household"), { target: { value: "Demo Household" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create household" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onSavePerson).not.toHaveBeenCalled();
    expect(onSaveSource).toHaveBeenCalledOnce();
    expect(onSaveGroup.mock.calls[0][0]).toMatchObject({ memberPersonIds: ["person-1"] });
  });
});
