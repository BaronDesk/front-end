import { describe, expect, it } from 'vitest';

import { entryText } from './wallet';

describe('ledger wording', () => {
  it('names ledger lines: a PAYMENT with a session is play time', () => {
    expect(entryText({ type: 'PAYMENT', sessionId: 's1' })).toBe('Play time');
    expect(entryText({ type: 'PAYMENT', sessionId: null })).toBe('Plan purchase');
    expect(entryText({ type: 'CREDIT', sessionId: null })).toBe('Top-up');
  });
});
