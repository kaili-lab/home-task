/**
 * Format a Date object to YYYY-MM-DD string in local timezone
 * This ensures consistency across the app and avoids timezone issues
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string in local timezone
 */
export function getTodayLocalDate(): string {
  return formatLocalDate(new Date());
}
