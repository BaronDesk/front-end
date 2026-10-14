import { useMemo } from 'react';

import type {
  Branch,
  BranchStation,
  CurrentSession,
  ExtendOptions,
  Membership,
  MembershipPlan,
  Pricing,
  PublicGame,
  Rank,
  Reservation,
  Subscription,
  SubscriptionPlan,
  Tournament,
  Wallet,
  WalletEntry,
} from '../core/api-types';
import { catalogService } from '../services/catalog.service';
import { plansService } from '../services/plans.service';
import { reservationsService } from '../services/reservations.service';
import { sessionsService, type SessionHistoryRow } from '../services/sessions.service';
import { tournamentsService } from '../services/tournaments.service';
import { walletService } from '../services/wallet.service';
import { useApiQuery } from './useApiQuery';

/*
 * The data a page reads, by name: a page asks for "my wallet", never for a
 * URL (the services own the routes). Each is a useApiQuery: data, error,
 * loading, reload(). A null argument means "don't fetch yet".
 */

// Catalog
export const useBranches = () => useApiQuery<Branch[]>(catalogService.paths.branches);
export const useBranchStations = (branchId: string | null) => useApiQuery<BranchStation[]>(branchId ? catalogService.paths.branchStations(branchId) : null);
export const usePricing = () => useApiQuery<Pricing>(catalogService.paths.pricing);
export const useRanks = () => useApiQuery<Rank[]>(catalogService.paths.ranks);
export const useGames = () => useApiQuery<PublicGame[]>(catalogService.paths.games);

// Wallet
export const useMyWallet = () => useApiQuery<Wallet>(walletService.paths.mine);
export const useWalletEntries = (take = 30) => useApiQuery<WalletEntry[]>(walletService.paths.entries(take));

// Plans
export const useMembershipPlans = () => useApiQuery<MembershipPlan[]>(plansService.paths.tiers);
export const usePasses = () => useApiQuery<SubscriptionPlan[]>(plansService.paths.passes);
export const useMyMemberships = () => useApiQuery<Membership[]>(plansService.paths.myMemberships);
export const useMySubscriptions = () => useApiQuery<Subscription[]>(plansService.paths.mySubscriptions);
/** The gamer's active membership tier and pass (undefined while loading or when there is none). */
export function useActivePlans() {
  const memberships = useMyMemberships();
  const subscriptions = useMySubscriptions();
  return {
    tier: memberships.data?.find((m) => m.status === 'ACTIVE')?.membershipPlan,
    pass: subscriptions.data?.find((s) => s.status === 'ACTIVE')?.subscriptionPlan,
  };
}

// Bookings and sessions
export const useMyBookings = () => useApiQuery<Reservation[]>(reservationsService.paths.mine);
export const useExtendOptions = (reservationId: string | null) =>
  useApiQuery<ExtendOptions>(reservationId ? reservationsService.paths.extendOptions(reservationId) : null);
export const useCurrentSession = () => useApiQuery<CurrentSession | null>(sessionsService.paths.current);
export const useSessionHistory = () => useApiQuery<SessionHistoryRow[]>(sessionsService.paths.history);

// Tournaments
/**
 * The tournaments: sample data until the backend has them (not a request
 * yet). Each game's poster comes from the catalog, matched by name, so a
 * tournament without its own cover shows it.
 */
export function useTournaments(): { data: Tournament[] } {
  const games = useGames();
  const data = useMemo(
    () =>
      tournamentsService.list().map((t) => ({
        ...t,
        game: { ...t.game, iconUrl: t.game.iconUrl ?? games.data?.find((g) => g.name === t.game.name)?.iconUrl ?? null },
      })),
    [games.data],
  );
  return { data };
}
