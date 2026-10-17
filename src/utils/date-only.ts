export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function monthInputValue(date: Date): string {
  return formatDateOnly(date).slice(0, 7);
}

export function previousBrisbaneMonthInput(): string {
  const currentMonth = parseDateOnly(`${todayDateOnly().slice(0, 7)}-01`);
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  return monthInputValue(currentMonth);
}

export function monthDateRange(monthInput: string): { start: Date; end: Date } {
  const start = parseDateOnly(`${monthInput}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  return { start, end };
}
