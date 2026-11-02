export function localDay(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return localDay(new Date(y!, m! - 1, d!, 12)) === value;
}

export function displayDate(value: string | null): string {
  if (!value) return '日期未知';
  if (isCalendarDay(value)) return value.replaceAll('-', '.');
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
