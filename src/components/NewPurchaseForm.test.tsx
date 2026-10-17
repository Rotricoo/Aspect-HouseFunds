import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NewPurchaseForm from "./NewPurchaseForm";

const people = [{ id: "person-1", name: "Demo Member", weeklyContribution: 0, isActive: true }];
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

describe("NewPurchaseForm", () => {
  afterEach(cleanup);

  it("submits a balanced household purchase", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <NewPurchaseForm people={people} paymentSources={paymentSources} categories={["Groceries"]} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search or choose a previous merchant"), { target: { value: "Demo Market" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount:" }), { target: { value: "12.50" } });
    fireEvent.change(screen.getByLabelText("Date:"), { target: { value: "2026-01-15" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Payment Source:" }), { target: { value: "source-1" } });
    fireEvent.change(screen.getByPlaceholderText("Product or service name"), { target: { value: "Demo groceries" } });
    fireEvent.change(screen.getAllByPlaceholderText("0.00")[1], { target: { value: "12.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Purchase" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      merchant: "Demo Market",
      receiptTotal: 12.5,
      paymentSourceId: "source-1",
    });
    expect(onSubmit.mock.calls[0][0].items[0]).toMatchObject({ name: "Demo groceries", totalAmount: 12.5 });
  });

  it("shows an error when receipt total does not match item total", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<NewPurchaseForm people={people} paymentSources={paymentSources} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Search or choose a previous merchant"), { target: { value: "Demo Market" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount:" }), { target: { value: "12.50" } });
    fireEvent.change(screen.getByLabelText("Date:"), { target: { value: "2026-01-15" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Payment Source:" }), { target: { value: "source-1" } });
    fireEvent.change(screen.getByPlaceholderText("Product or service name"), { target: { value: "Demo groceries" } });
    fireEvent.change(screen.getAllByPlaceholderText("0.00")[1], { target: { value: "10.00" } });
    expect(screen.getByText("Receipt does not balance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Purchase" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
