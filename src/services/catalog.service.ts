/** What every signed-in user may read: branches, prices, ranks, games. */
export const catalogService = {
  paths: {
    branches: '/branches',
    branchStations: (branchId: string) => `/branches/${branchId}/stations`,
    pricing: '/pricing',
    ranks: '/ranks',
    games: '/api/v1/games',
  },
};
