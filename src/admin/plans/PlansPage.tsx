import { useEffect, useState, type FormEvent } from 'react';

import { api } from '../../api/http';
import type { MembershipPlan, Pricing, SubscriptionPlan } from '../../api/types';
import { ErrorBox } from '../../shared/ErrorBox';
import { CURRENCY, formatMoney } from '../../shared/format';
import { ActionMessages, useAction, type Action } from '../../shared/useAction';
import { useApiQuery, type ApiQuery } from '../../shared/useApiQuery';

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

function PricingForm({ action }: { action: Action }) {
  const pricing = useApiQuery<Pricing>('/pricing');
  const [form, setForm] = useState({ ratePerHour: '', bookingFee: '', lowBalanceMinutes: '' });

  useEffect(() => {
    if (pricing.data) {
      setForm({
        ratePerHour: String(pricing.data.ratePerHour),
        bookingFee: String(pricing.data.bookingFee),
        lowBalanceMinutes: String(pricing.data.lowBalanceMinutes),
      });
    }
  }, [pricing.data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = { ratePerHour: Number(form.ratePerHour), bookingFee: Number(form.bookingFee), lowBalanceMinutes: Number(form.lowBalanceMinutes) };
    const saved = await action.run('pricing', () => api<Pricing>('PUT', '/pricing', body), 'Prices saved.');
    if (saved) pricing.setData(() => saved);
  }

  return (
    <form onSubmit={save}>
      <ErrorBox error={pricing.error} />
      <fieldset className="wide-labels">
        <legend>Prices</legend>
        <div className="form-row">
          <label htmlFor="p-rate">Play time ({CURRENCY} / hour)</label>
          <input id="p-rate" type="number" min="0.001" step="0.001" required value={form.ratePerHour} onChange={(e) => setForm({ ...form, ratePerHour: e.target.value })} />
        </div>
        <div className="form-row">
          <label htmlFor="p-fee">Booking fee ({CURRENCY})</label>
          <input id="p-fee" type="number" min="0" step="0.001" required value={form.bookingFee} onChange={(e) => setForm({ ...form, bookingFee: e.target.value })} />
        </div>
        <div className="form-row">
          <label htmlFor="p-low">Low-balance warning (minutes left)</label>
          <input id="p-low" type="number" min="0" step="1" required value={form.lowBalanceMinutes} onChange={(e) => setForm({ ...form, lowBalanceMinutes: e.target.value })} />
        </div>
        <div className="form-row">
          <label />
          <button type="submit" disabled={action.busy === 'pricing' || !pricing.data}>
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
