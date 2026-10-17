/**
 * Formats a byte count for humans. Sizes arrive from the API as strings
 * because they are BigInt server-side and would lose precision as JS numbers.
 */
export function formatBytes(
  bytes: number | bigint | string,
  fractionDigits = 1,
): string {
  const value = typeof bytes === 'string' ? Number(bytes) : Number(bytes);

  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(
    Math.floor(Math.log(Math.abs(value)) / Math.log(1024)),
    units.length - 1,
  );
  const scaled = value / 1024 ** exponent;

  // Whole bytes never need a decimal point.
  const digits = exponent === 0 ? 0 : fractionDigits;
  return `${scaled.toFixed(digits)} ${units[exponent]}`;
}

/** Safely parses a BigInt-as-string from the API. */
export function parseBigIntString(value: string | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> =
  [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];

export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';

  let duration = (date.getTime() - Date.now()) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeFormatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return '—';
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

/** Percentage of `used` against `total`, clamped to 0–100. */
export function usagePercent(used: bigint, total: bigint | null): number {
  if (total === null || total === 0n) return 0;
  const percent = Number((used * 10000n) / total) / 100;
  return Math.max(0, Math.min(100, percent));
}
