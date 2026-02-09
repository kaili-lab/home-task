export function toUtcIso(value: Date | string): string;
export function toUtcIso(value: Date | string | null | undefined): string | null;
export function toUtcIso(value: null | undefined): null;
export function toUtcIso(value: Date | string | null | undefined): string | null {
  // 统一按 UTC 解析与输出，避免无时区字符串被 JS 当成本地时区而产生偏移
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = hasTimezoneInfo(trimmed) ? trimmed : `${trimmed.replace(" ", "T")}Z`;
  return new Date(normalized).toISOString();
}

function hasTimezoneInfo(value: string): boolean {
  // 保留已有时区语义，避免重复追加 Z 或改写偏移信息
  return /Z$/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value);
}
