export type ApiRecord = Record<string, unknown>;

export function asRecord(value: unknown): ApiRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as ApiRecord
    : undefined;
}

export function readText(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function readNumber(record: ApiRecord, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function readBoolean(record: ApiRecord, key: string): boolean | undefined {
  return typeof record[key] === "boolean" ? record[key] : undefined;
}

export function findRows(value: unknown, preferredKeys: string[] = []): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];

  for (const key of [...preferredKeys, "data", "items", "records", "results"]) {
    const child = record[key];
    if (Array.isArray(child)) return child;
    if (child && typeof child === "object") {
      const nested = findRows(child, preferredKeys);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function unwrapPayload(value: unknown): unknown {
  let current = value;
  while (asRecord(current) && "data" in (current as ApiRecord)) {
    current = (current as ApiRecord).data;
  }
  return current;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatDate(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(date);
}

export function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
}