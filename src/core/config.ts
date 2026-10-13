/*
 * Build-time settings (Vite env). See .env.example.
 */

export const config = {
  /**
   * Origin prefixed to every REST call and the /dashboard-io socket. Empty =
   * same origin: the Vite dev proxy (dev) or Caddy (build) forwards to the
   * backend. Paths carry their own `/api/v1` where the backend has one.
   */
  apiBase: import.meta.env.VITE_API_BASE ?? '',
};
