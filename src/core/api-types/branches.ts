/** Branches, their stations as gamers see them, and their prices. */

/**
 * A branch (GET /branches; HQ creates and edits them with POST / PATCH
 * /branches). Until the list loads, ids come from GET /machines and the label
 * is built from the PC serial numbers (admin/branches/branches.ts).
 */
export interface Branch {
  id: string;
  name: string;
  /** From GET /branches; absent for a branch only known by id. */
  location?: string;
}

/** GET /branches/:id/stations: a station as the booking page shows it (never who booked). */
export interface BranchStation {
  id: string;
  name: string;
  serialNumber: string;
  online: boolean;
  busyNow: boolean;
  /** End of the current booking (back-to-back ones chained), when busy now. */
  busyUntil: string | null;
  /** Bookings in the next 7 days. */
  bookings: { startTime: string; endTime: string }[];
}

/**
 * GET / PUT /pricing (pricing/util/public-pricing.ts): one price list for
 * every branch, in coins per hour. GET is 404 PRICING_NOT_SET until HQ sets
 * it, and a session can't start then. Only HQ (ADMIN) may PUT.
 */
export interface Pricing {
  /** Play now (walk-in). */
  paygRate: number;
  /** Play booked ahead. */
  bookingRate: number;
  updatedAt: string;
}
