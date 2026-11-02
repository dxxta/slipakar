export type ListQuery = {
  page: number;
  limit: number;
  q: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
};

export function listQueryString(query: ListQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  });
  const search = query.q.trim();
  if (search) params.set('q', search);
  return `?${params.toString()}`;
}
