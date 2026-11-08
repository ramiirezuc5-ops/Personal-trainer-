import { z } from 'zod';

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export const pageInfo = ({ page, limit }) => ({ page, limit, skip: (page - 1) * limit });
export const pageResult = (items, total, { page, limit }) => ({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
