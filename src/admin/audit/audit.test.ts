import { describe, expect, it } from 'vitest';

import { actionText, AUDIT_ACTIONS, detailsText, isSerious, targetText } from './audit';

describe('audit log wording', () => {
  it('names every known action, and words an unknown one from its code', () => {
    for (const a of AUDIT_ACTIONS) expect(actionText(a)).not.toMatch(/_/);
    expect(actionText('ROLE_CHANGED')).toBe('Role changed');
    expect(actionText('UPDATE')).toBe('Update');
    expect(actionText('STATION_RENAMED')).toBe('Station renamed');
    expect(isSerious('WALLET_REFUND')).toBe(true);
    expect(isSerious('BRANCH_UPDATED')).toBe(false);
  });

  it('shows the target by kind and name, else a short id, else as sent', () => {
    expect(targetText({ target: 'user:3f2a9c1e-0000-4000-8000-000000000000', metadata: { targetName: 'employee.manar1' } })).toBe(
      'User employee.manar1',
    );
    expect(targetText({ target: 'machine:3f2a9c1e-0000-4000-8000-000000000000', metadata: null })).toBe('Station 3f2a9c1e…');
    expect(targetText({ target: 'subscription-plan:p1', metadata: {} })).toBe('Pass p1');
    expect(targetText({ target: 'pricing', metadata: null })).toBe('pricing');
  });

  it('lists the details without the target name or empty values', () => {
    expect(detailsText({ targetName: 'x', from: 'EMPLOYEE', to: 'MANAGER', note: '', reason: null })).toBe('from: EMPLOYEE · to: MANAGER');
    expect(detailsText({ amount: 5000, lines: [1, 2] })).toBe('amount: 5000 · lines: [1,2]');
    expect(detailsText(null)).toBe('');
  });
});
