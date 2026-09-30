import { useEffect, useState, type FormEvent } from 'react';

import { api, ApiError } from '../../api/http';
import type { BranchPricing, MembershipPlan, SubscriptionPlan } from '../../api/types';
import { ErrorBox } from '../../shared/ErrorBox';
import { centsToDinars, CURRENCY, dinarsToCents, formatCents, formatDateTime, formatMoney } from '../../shared/format';
import { ActionMessages, useAction, type Action } from '../../shared/useAction';
import { useApiQuery, type ApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';

type Kind = 'membership' | 'subscription';

const KIND = {
  membership: {
    title: 'Membership tiers',
    help: 'A discount on every hour of play while the membership lasts.',
    path: '/membership-plans',
    extraLabel: 'Discount (%)',
    extraKey: 'discountPercent',
  },
  subscription: {
    title: 'Hour passes',
    help: 'Prepaid hours, used before the wallet is charged.',
    path: '/subscription-plans',
    extraLabel: 'Hours included',
    extraKey: 'hoursIncluded',
  },
} as const;

type Plan = MembershipPlan | SubscriptionPlan;

interface PlanForm {
  id: string | null;
  name: string;
  price: string;
  durationDays: string;
  extra: string;
}

const EMPTY: PlanForm = { id: null, name: '', price: '', durationDays: '30', extra: '' };

function extraOf(kind: Kind, p: Plan): number {
  return kind === 'membership' ? (p as MembershipPlan).discountPercent : (p as SubscriptionPlan).hoursIncluded;
}

function PlanSection({ kind, plans, action }: { kind: Kind; plans: ApiQuery<Plan[]>; action: Action }) {
  const k = KIND[kind];
  const [form, setForm] = useState<PlanForm>(EMPTY);
  const busyKey = `save-${kind}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      price: Number(form.price),
      durationDays: Number(form.durationDays),
      [k.extraKey]: Number(form.extra),
    };
    const saved = await action.run(
      busyKey,
      () => api<Plan>(form.id ? 'PATCH' : 'POST', form.id ? `${k.path}/${form.id}` : k.path, body),
      (p) => `${p.name} ${form.id ? 'updated' : 'created'}.`,
    );
    if (saved) {
      setForm(EMPTY);
      plans.reload();
    }
  }

  return (
    <div>
      <h2>{k.title}</h2>
      <p className="muted">{k.help}</p>
      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>{k.extraLabel}</th>
            <th>Lasts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(plans.data ?? []).map((p) => (
            <tr key={p.id}>
              <td>
                <b>{p.name}</b>
              </td>
              <td>{formatMoney(p.price)}</td>
              <td>{kind === 'membership' ? `−${extraOf(kind, p)} %` : `${extraOf(kind, p)} h`}</td>
              <td>{p.durationDays} days</td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({ id: p.id, name: p.name, price: String(p.price), durationDays: String(p.durationDays), extra: String(extraOf(kind, p)) })
                  }
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={save} style={{ marginTop: 8 }}>
        <fieldset>
          <legend>{form.id ? `Edit ${form.name}` : `New ${kind === 'membership' ? 'tier' : 'pass'}`}</legend>
          <div className="form-row">
            <label htmlFor={`${kind}-name`}>Name</label>
            <input id={`${kind}-name`} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor={`${kind}-price`}>Price ({CURRENCY})</label>
            <input id={`${kind}-price`} type="number" min="0" step="0.001" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor={`${kind}-extra`}>{k.extraLabel}</label>
            <input
              id={`${kind}-extra`}
              type="number"
              min={kind === 'membership' ? 0 : 0.5}
              max={kind === 'membership' ? 100 : undefined}
              step={kind === 'membership' ? 1 : 0.5}
              required
              value={form.extra}
              onChange={(e) => setForm({ ...form, extra: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${kind}-days`}>Lasts (days)</label>
            <input id={`${kind}-days`} type="number" min="1" step="1" required value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
          </div>
          <div className="form-row">
            <label />
            <button type="submit" disabled={action.busy === busyKey}>
              {form.id ? 'Save changes' : 'Create'}
            </button>{' '}
            {form.id && (
              <button type="button" className="secondary" onClick={() => setForm(EMPTY)}>
                Cancel
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  );
}

/**
 * Play prices of one branch (GET / PUT /branches/:branchId/pricing), in dinars
 * on screen and integer cents on the wire. A branch without prices can't start
 * sessions, so the empty form says so.
 */
function PricingForm({ action }: { action: Action }) {
  const { branchId, branchName } = useBranchScope();
  const pricing = useApiQuery<BranchPricing>(branchId ? `/branches/${branchId}/pricing` : null);
  const [form, setForm] = useState({ paygRate: '', bookingRate: '' });
  const notSet = pricing.error instanceof ApiError && pricing.error.code === 'PRICING_NOT_SET';

  useEffect(() => {
    if (pricing.data) {
      setForm({ paygRate: centsToDinars(pricing.data.paygRate), bookingRate: centsToDinars(pricing.data.bookingRate) });
    } else if (notSet) {
      setForm({ paygRate: '', bookingRate: '' });
    }
  }, [pricing.data, notSet]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const paygRate = dinarsToCents(form.paygRate);
    const bookingRate = dinarsToCents(form.bookingRate);
    if (!branchId || paygRate === null || bookingRate === null) return;
    const saved = await action.run(
      'pricing',
      () => api<BranchPricing>('PUT', `/branches/${branchId}/pricing`, { paygRate, bookingRate }),
      `Prices of ${branchName(branchId)} saved.`,
    );
    if (saved) {
      pricing.setData(() => saved);
      pricing.reload(); // clears a PRICING_NOT_SET error
    }
  }

  if (!branchId) {
    return <p className="muted">Pick a branch in the top bar to see and change its prices: each branch has its own.</p>;
  }

  return (
    <form onSubmit={save}>
      {!notSet && <ErrorBox error={pricing.error} />}
      <fieldset className="wide-labels">
        <legend>Prices of {branchName(branchId)}</legend>
        {notSet && (
          <p className="status-bad">No prices set for this branch yet: sessions can&apos;t start until they are.</p>
        )}
        <div className="form-row">
          <label htmlFor="p-payg">Walk-in play ({CURRENCY} / hour)</label>
          <input
            id="p-payg"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.paygRate}
            onChange={(e) => setForm({ ...form, paygRate: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label htmlFor="p-booking">Booked play ({CURRENCY} / hour)</label>
          <input
            id="p-booking"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.bookingRate}
            onChange={(e) => setForm({ ...form, bookingRate: e.target.value })}
          />
        </div>
        {pricing.data && (
          <p className="muted">
            Now: walk-in {formatCents(pricing.data.paygRate)} / hour, booked {formatCents(pricing.data.bookingRate)} / hour (changed{' '}
            {formatDateTime(pricing.data.updatedAt)}). Membership discounts apply on top.
          </p>
        )}
        <div className="form-row">
          <label />
          <button type="submit" disabled={action.busy === 'pricing' || pricing.loading}>
            Save prices
          </button>
        </div>
      </fieldset>
    </form>
  );
}

/** Prices, membership tiers and hour passes (brief §6.9). Assigning them to a gamer is on the gamer's profile. */
export function PlansPage() {
  const action = useAction();
  const tiers = useApiQuery<Plan[]>(KIND.membership.path);
  const passes = useApiQuery<Plan[]>(KIND.subscription.path);

  return (
    <>
      <h1>Plans &amp; prices</h1>
      <p>
        To give a plan to a gamer, open their profile under <b>Users &amp; Staff</b>.
      </p>
      <ActionMessages action={action} />
      <ErrorBox error={tiers.error ?? passes.error} />
      <PricingForm action={action} />
      <div className="columns">
        <PlanSection kind="membership" plans={tiers} action={action} />
        <PlanSection kind="subscription" plans={passes} action={action} />
      </div>
    </>
  );
}
