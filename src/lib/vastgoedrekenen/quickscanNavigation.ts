export const QUICKSCAN_QUERY_PARAM = 'calculation';

export function buildQuickscanObjectHref(objectId: string, calculationId: string): string {
  return `/objecten/${encodeURIComponent(objectId)}?tab=vastgoedrekenen&${QUICKSCAN_QUERY_PARAM}=${encodeURIComponent(calculationId)}#vastgoedrekenen`;
}

export function readRequestedQuickscanId(search: string): string | null {
  return new URLSearchParams(search).get(QUICKSCAN_QUERY_PARAM);
}
