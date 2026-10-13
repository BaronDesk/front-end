/** The audit log (HQ): read only. */
export const auditService = {
  paths: {
    list: (params: URLSearchParams) => `/audit-logs?${params}`,
  },
};
