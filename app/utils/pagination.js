const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function parsePaginationParams(req) {
  const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit ?? String(DEFAULT_LIMIT), 10), 1),
    MAX_LIMIT,
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPaginationResponse({ page, limit, total }) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export const PaginationUtils = {
  parsePaginationParams,
  buildPaginationResponse,
};
