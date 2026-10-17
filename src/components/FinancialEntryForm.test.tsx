import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FinancialEntryForm from "./FinancialEntryForm";

const paymentSources = [
  {
    id: "source-1",
    name: "Demo Account",
    type: "bank-account" as const,
    ownership: "household" as const,
    managedBy: "household" as const,
    openingBalance: null,
  },
];
const people = [
  { id: "person-1", name: "Demo Member", weeklyContribution: 0, isActive: true },
  { id: "person-2", name: "Second Member", weeklyContribution: 0, isActive: true },
];

describe("FinancialEntryForm", () => {
  afterEach(cleanup);

  const baseProps = {
    purchases: [],
    paymentSources,
    people,
    onClose: vi.fn(),
    onRefundAdd: vi.fn().mockResolvedValue(undefined),
    onReimbursementAdd: vi.fn().mockResolvedValue(undefined),
    onTransferAdd: vi.fn().mockResolvedValue(undefined),
    onBalanceCheckAdd: vi.fn().mockResolvedValue(undefined),
    onAdjustmentAdd: vi.fn().mockResolvedValue(undefined),
  };

  it("records a physical balance check", async () => {
    render(<FinancialEntryForm {...baseProps} />);

    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "balance-check" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "125.75" } });
    fireEvent.click(screen.getByRole("button", { name: "Record event" }));

    await waitFor(() => expect(baseProps.onBalanceCheckAdd).toHaveBeenCalledOnce());
    expect(baseProps.onBalanceCheckAdd.mock.calls[0][0]).toMatchObject({ countedAmount: 125.75, fundSourceId: "source-1" });
  });

  it("rejects a reimbursement between the same person", async () => {
    render(<FinancialEntryForm {...baseProps} />);

    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "reimbursement" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Paid by"), { target: { value: "person-1" } });
    fireEvent.change(screen.getByLabelText("Paid to"), { target: { value: "person-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Record event" }));

    expect(await screen.findByText("A reimbursement must move between two different people.")).toBeInTheDocument();
    expect(baseProps.onReimbursementAdd).not.toHaveBeenCalled();
  });
});
