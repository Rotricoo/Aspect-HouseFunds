export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU");
}
