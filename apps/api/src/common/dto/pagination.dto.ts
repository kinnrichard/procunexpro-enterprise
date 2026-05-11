export class PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function parsePagination(query: { page?: string; limit?: string; search?: string }): PaginationParams {
  return {
    page: query.page ? Number.parseInt(query.page) : undefined,
    limit: query.limit ? Number.parseInt(query.limit) : undefined,
    search: query.search,
  };
}
