// Fixed bands are independent of the current filters or loaded pages.
export function frequencyBand(count: number): 'none' | 'low' | 'medium' | 'high' {
  if (count === 0) return 'none';
  if (count <= 2) return 'low';
  if (count <= 4) return 'medium';
  return 'high';
}
