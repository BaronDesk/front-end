import { useEffect, useState, type FormEvent } from 'react';

import { api, ApiError } from '../../api/http';
import type { BranchPricing, MembershipPlan, MembershipPlanInput, SubscriptionPlan, SubscriptionPlanInput } from '../../api/types';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { CURRENCY, dinarsToMillimes, formatDateTime, formatMillimes, formatMoney, millimesToDinars } from '../../shared/lib/format';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction, type Action } from '../../shared/hooks/useAction';
import {
  benefitsText,
  discountText,
  MAX_WINDOWS,
  NEW_WINDOW,
  rowsToWindows,
  WEEK_DAYS,
  windowRows,
  type WindowRow,
} from '../../shared/lib/plans';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { useBranchScope } from '../branches/BranchContext';

/** Membership tiers: a discount on every hour of play, and how far ahead a member may book. */
function TierSection({ action }: { action: Action }) {
  const tiers = useApiQuery<MembershipPlan[]>('/membership-plans');
  const empty = { id: null as string | null, name: '', price: '', durationDays: '30', discountPercent: '10', bookingAdvanceDays: '7' };
  const [form, setForm] = useState(empty);

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: MembershipPlanInput = {
      name: form.name.trim(),
      price: Number(form.price),
      durationDays: Number(form.durationDays),
      discountPercent: Number(form.discountPercent),
      bookingAdvanceDays: Number(form.bookingAdvanceDays),
    };
    const saved = await action.run(
      'save-tier',
      () => api<MembershipPlan>(form.id ? 'PATCH' : 'POST', form.id ? `/membership-plans/${form.id}` : '/membership-plans', body),
      (p) => `Tier ${p.name} ${form.id ? 'updated' : 'created'}.`,
    );
    if (saved) {
      setForm(empty);
      tiers.reload();
    }
  }

  async function remove(p: MembershipPlan) {
    if (!window.confirm(`Delete the tier ${p.name}?`)) return;
    const done = await action.run(p.id, () => api('DELETE', `/membership-plans/${p.id}`).then(() => true), `Tier ${p.name} deleted.`);
    if (done) tiers.reload();
  }

  return (
    <div>
      <h2>Membership tiers</h2>
      <p className="muted">A discount on every hour of play while the membership lasts. Gamers buy them in the BaronDesk app.</p>
      <ErrorBox error={tiers.error} />
      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>Discount</th>
            <th>Book ahead</th>
            <th>Lasts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(tiers.data ?? []).map((p) => (
            <tr key={p.id}>
              <td>
                <b>{p.name}</b>
              </td>
              <td>{formatMoney(p.price)}</td>
              <td>{discountText(p.discountPercent)}</td>
              <td>{p.bookingAdvanceDays} days</td>
              <td>{p.durationDays} days</td>
              <td className="nowrap">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      price: String(Number(p.price)),
                      durationDays: String(p.durationDays),
                      discountPercent: String(Number(p.discountPercent)),
                      bookingAdvanceDays: String(p.bookingAdvanceDays),
                    })
                  }
                >
                  Edit
                </button>{' '}
                <button type="button" className="secondary" disabled={action.busy === p.id} onClick={() => remove(p)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={save} style={{ marginTop: 8 }}>
        <fieldset>
          <legend>{form.id ? `Edit ${form.name}` : 'New tier'}</legend>
          <div className="form-row">
            <label htmlFor="t-name">Name</label>
            <input id="t-name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="t-price">Price ({CURRENCY})</label>
            <input id="t-price" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="t-discount">Discount (%)</label>
            <input
              id="t-discount"
              type="number"
              min="0"
              max="100"
              step="1"
              required
              value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="t-advance">Book ahead (days)</label>
            <input
              id="t-advance"
              type="number"
              min="0"
              max="365"
              step="1"
              required
              value={form.bookingAdvanceDays}
              onChange={(e) => setForm({ ...form, bookingAdvanceDays: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="t-days">Lasts (days)</label>
            <input
              id="t-days"
              type="number"
              min="1"
              max="3650"
              step="1"
              required
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label />
            <button type="submit" disabled={action.busy === 'save-tier'}>
              {form.id ? 'Save changes' : 'Create tier'}
            </button>{' '}
            {form.id && (
              <button type="button" className="secondary" onClick={() => setForm(empty)}>
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
 * Passes: a monthly price for cheaper or free play inside time windows
 * (e.g. every night 00:00–06:00 free, weekends half price). A pass has one or
 * more windows, added, changed and removed here. Gamers who already bought a
 * pass keep the windows they paid for (the backend snapshots them).
 */
function PassSection({ action }: { action: Action }) {
  const passes = useApiQuery<SubscriptionPlan[]>('/subscription-plans');
  const empty = {
    id: null as string | null,
    name: '',
    price: '',
    durationDays: '30',
    windows: [NEW_WINDOW],
    // Editing a pass whose benefits aren't windows (seeded shapes): saved
    // without benefits, so they stay, unless windows are added.
    otherBenefits: false,
  };
  const [form, setForm] = useState(empty);
  const windows = rowsToWindows(form.windows);
  const canSave = windows !== null && (windows.length > 0 || form.otherBenefits);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!windows || !canSave) return;
    const base = { name: form.name.trim(), price: Number(form.price), durationDays: Number(form.durationDays) };
    const body: Partial<SubscriptionPlanInput> = windows.length ? { ...base, benefits: { windows } } : base;
    const saved = await action.run(
      'save-pass',
      () => api<SubscriptionPlan>(form.id ? 'PATCH' : 'POST', form.id ? `/subscription-plans/${form.id}` : '/subscription-plans', body),
      (p) => `Pass ${p.name} ${form.id ? 'updated' : 'created'}.`,
    );
    if (saved) {
      setForm(empty);
      passes.reload();
    }
  }

  async function remove(p: SubscriptionPlan) {
    if (!window.confirm(`Delete the pass ${p.name}?`)) return;
    const done = await action.run(p.id, () => api('DELETE', `/subscription-plans/${p.id}`).then(() => true), `Pass ${p.name} deleted.`);
    if (done) passes.reload();
  }

  function edit(p: SubscriptionPlan) {
    const rows = windowRows(p.benefits);
    setForm({ id: p.id, name: p.name, price: String(Number(p.price)), durationDays: String(p.durationDays), windows: rows, otherBenefits: rows.length === 0 });
  }

  function setWindow(i: number, change: Partial<WindowRow>) {
    setForm((f) => ({ ...f, windows: f.windows.map((w, j) => (j === i ? { ...w, ...change } : w)) }));
  }

  function toggleDay(i: number, d: number) {
    const days = form.windows[i].days;
    setWindow(i, { days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((x, y) => x - y) });
  }

  function addWindow() {
    setForm((f) => ({ ...f, windows: [...f.windows, NEW_WINDOW] }));
  }

  function removeWindow(i: number) {
    setForm((f) => ({ ...f, windows: f.windows.filter((_, j) => j !== i) }));
  }

  return (
    <div>
      <h2>Passes</h2>
      <p className="muted">A monthly price for cheaper or free play at set times. Gamers buy them in the BaronDesk app.</p>
      <ErrorBox error={passes.error} />
      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>Benefits</th>
            <th>Lasts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(passes.data ?? []).map((p) => (
            <tr key={p.id}>
              <td>
                <b>{p.name}</b>
              </td>
              <td>{formatMoney(p.price)}</td>
              <td>{benefitsText(p.benefits)}</td>
              <td>{p.durationDays} days</td>
              <td className="nowrap">
                <button type="button" className="secondary" onClick={() => edit(p)}>
                  Edit
                </button>{' '}
                <button type="button" className="secondary" disabled={action.busy === p.id} onClick={() => remove(p)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={save} style={{ marginTop: 8 }}>
        <fieldset>
          <legend>{form.id ? `Edit ${form.name}` : 'New pass'}</legend>
          <div className="form-row">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="p-price">Price ({CURRENCY})</label>
            <input id="p-price" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="p-days">Lasts (days)</label>
            <input
              id="p-days"
              type="number"
              min="1"
              max="3650"
              step="1"
              required
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            />
          </div>
          <p className="muted">
            Windows: when the pass gives its discount (100 % = free). A window that ends before it starts runs past
            midnight. Changes apply to new buyers; gamers who already bought the pass keep what they paid for.
          </p>
          {form.otherBenefits && (
            <p className="muted">
              This pass&apos;s benefits ({benefitsText(passes.data?.find((p) => p.id === form.id)?.benefits)}) aren&apos;t
              time windows: they stay as they are unless you add windows, which replace them.
            </p>
          )}
          {form.windows.length > 0 && (
            <table className="grid">
              <thead>
                <tr>
                  <th>Days</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Discount (%)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.windows.map((w, i) => (
                  <tr key={i}>
                    <td className="nowrap">
                      {WEEK_DAYS.map((d) => (
                        <label key={d.value} className="inline">
                          <input type="checkbox" checked={w.days.includes(d.value)} onChange={() => toggleDay(i, d.value)} /> {d.label}
                        </label>
                      ))}
                      {w.days.length === 0 && <span className="status-bad">pick a day</span>}
                    </td>
                    <td>
                      <input aria-label={`Window ${i + 1} from`} type="time" required value={w.startTime} onChange={(e) => setWindow(i, { startTime: e.target.value })} />
                    </td>
                    <td>
                      <input aria-label={`Window ${i + 1} to`} type="time" required value={w.endTime} onChange={(e) => setWindow(i, { endTime: e.target.value })} />
                    </td>
                    <td>
                      <input
                        aria-label={`Window ${i + 1} discount`}
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        required
                        value={w.discountPercent}
                        onChange={(e) => setWindow(i, { discountPercent: e.target.value })}
                      />
                    </td>
                    <td>
                      <button type="button" className="secondary" onClick={() => removeWindow(i)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="form-row" style={{ marginTop: 6 }}>
            <button type="button" className="secondary" disabled={form.windows.length >= MAX_WINDOWS} onClick={addWindow}>
              Add window
            </button>{' '}
            {form.windows.length === 0 && !form.otherBenefits && <span className="status-bad">A pass needs at least one window.</span>}
          </div>
          <div className="form-row">
            <label />
            <button type="submit" disabled={action.busy === 'save-pass' || !canSave}>
              {form.id ? 'Save changes' : 'Create pass'}
            </button>{' '}
            {form.id && (
              <button type="button" className="secondary" onClick={() => setForm(empty)}>
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
 * on screen and integer millimes on the wire. A branch without prices can't start
 * sessions, so the empty form says so.
 */
function PricingForm({ action }: { action: Action }) {
  const { branchId, branchName } = useBranchScope();
  const pricing = useApiQuery<BranchPricing>(branchId ? `/branches/${branchId}/pricing` : null);
  const [form, setForm] = useState({ paygRate: '', bookingRate: '' });
  const notSet = pricing.error instanceof ApiError && pricing.error.code === 'PRICING_NOT_SET';

  useEffect(() => {
    if (pricing.data) {
      setForm({ paygRate: millimesToDinars(pricing.data.paygRate), bookingRate: millimesToDinars(pricing.data.bookingRate) });
    } else if (notSet) {
      setForm({ paygRate: '', bookingRate: '' });
    }
  }, [pricing.data, notSet]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const paygRate = dinarsToMillimes(form.paygRate);
    const bookingRate = dinarsToMillimes(form.bookingRate);
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
            min="0.001"
            step="0.001"
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
            min="0.001"
            step="0.001"
            required
            value={form.bookingRate}
            onChange={(e) => setForm({ ...form, bookingRate: e.target.value })}
          />
        </div>
        {pricing.data && (
          <p className="muted">
            Now: walk-in {formatMillimes(pricing.data.paygRate)} / hour, booked {formatMillimes(pricing.data.bookingRate)} / hour (changed{' '}
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

/** Prices, membership tiers and passes (brief §6.9). Gamers buy tiers and passes in the BaronDesk app. */
export function PlansPage() {
  const action = useAction();
  return (
    <>
      <h1>Plans &amp; prices</h1>
      <ActionMessages action={action} />
      <PricingForm action={action} />
      <div className="columns">
        <TierSection action={action} />
        <PassSection action={action} />
      </div>
    </>
  );
}
