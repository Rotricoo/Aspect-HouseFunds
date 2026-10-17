export type MoneyCents = number & { readonly __moneyCents: unique symbol };

export function toMoneyCents(amount: number): MoneyCents {
  if (!Number.isFinite(amount)) throw new Error("Money amount must be a finite number.");
  return Math.round(amount * 100) as MoneyCents;
}

export function fromMoneyCents(cents: MoneyCents | number): number {
  return cents / 100;
}

export function addMoney(...amounts: number[]): number {
  return fromMoneyCents(amounts.reduce((total, amount) => total + toMoneyCents(amount), 0) as MoneyCents);
}

export function subtractMoney(amount: number, ...subtractions: number[]): number {
  return fromMoneyCents(subtractions.reduce((total, subtraction) => total - toMoneyCents(subtraction), toMoneyCents(amount)) as MoneyCents);
}

export function sumMoney<T>(values: T[], getAmount: (value: T) => number): number {
  return fromMoneyCents(values.reduce((total, value) => total + toMoneyCents(getAmount(value)), 0) as MoneyCents);
}
