/**
 * Safely parses Kick API dates.
 * Kick API returns UTC dates like "2026-10-22 17:50:56" without timezone suffix.
 * If parsed directly without timezone in Node.js (Turkey UTC+3), it gets treated
 * as local time, creating an exact 3-hour calculation offset!
 * This function ensures it is always parsed as pure UTC.
 */
export function parseKickDate(dateInput?: string | Date | null): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  const str = String(dateInput).trim();

  // "YYYY-MM-DD HH:mm:ss" Kick format -> convert to "YYYY-MM-DDTHH:mm:ssZ"
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }

  // "YYYY-MM-DDTHH:mm:ss" without Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str + 'Z');
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Calculates human readable duration between two dates.
 * Example: "2 saat 15 dakika", "45 dakika", "5 dakika"
 */
export function formatDuration(startDateInput: Date | string, endDateInput: Date | string = new Date()): string {
  const startDate = parseKickDate(startDateInput);
  const endDate = parseKickDate(endDateInput);

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} saat ${minutes} dakika`;
  } else if (hours > 0) {
    return `${hours} saat`;
  } else {
    return `${Math.max(1, minutes)} dakika`;
  }
}

/**
 * Format compact duration like "02:45:10" or "45:10"
 */
export function formatDigitalDuration(startDateInput: Date | string, endDateInput: Date | string = new Date()): string {
  const startDate = parseKickDate(startDateInput);
  const endDate = parseKickDate(endDateInput);

  const diffSec = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format viewer count: 1250 -> "1.250", 15200 -> "15.200"
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('tr-TR').format(num);
}
