import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface SortParams {
  orderBy: string;
  orderDirection: 'ASC' | 'DESC';
}

// Extract pagination from query params
export const getPagination = (req: Request): PaginationParams => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  // Allow up to 10000 records (removed 100 cap to support full student list)
  const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

// Extract sort parameters
export const getSort = (req: Request, defaultOrderBy: string = 'createdAt'): SortParams => {
  const orderBy = (req.query.orderBy as string) || defaultOrderBy;
  const orderDirection = (req.query.orderDirection as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return { orderBy, orderDirection };
};

// Extract search query
export const getSearch = (req: Request): string | undefined => {
  const search = req.query.search as string;
  return search?.trim() || undefined;
};

