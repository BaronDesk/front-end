import { describe, expect, it } from 'vitest';

import { coinsInCurrency, currencyToCoins, formatCoins, formatSignedCoins, parseCoins } from './format';

describe('money: whole coins on screen and on the wire', () => {
  it('formats what the server sent', () => {
    expect(formatCoins(4000)).toBe('4,000 coins');
    expect(formatCoins(1)).toBe('1 coin');
    expect(formatCoins(0)).toBe('0 coins');
    expect(formatCoins(null)).toBe('—');
    expect(formatSignedCoins(10000)).toBe('+10,000 coins');
    expect(formatSignedCoins(-1500)).toBe('-1,500 coins');
  });

  it('reads whole coins from a form', () => {
    expect(parseCoins('4000')).toBe(4000);
    expect(parseCoins(' 4 000 ')).toBe(4000);
    expect(parseCoins('4,000')).toBe(4000);
    expect(parseCoins('0')).toBe(0);
    expect(parseCoins('4.5')).toBeNull();
    expect(parseCoins('-5')).toBeNull();
    expect(parseCoins('')).toBeNull();
  });

  it('turns the cash taken at the desk into coins (1000 coins = 1 DT)', () => {
    expect(currencyToCoins('10')).toBe(10000);
    expect(currencyToCoins('2,5')).toBe(2500);
    expect(currencyToCoins('0.0004')).toBe(0);
    expect(currencyToCoins('')).toBeNull();
    expect(currencyToCoins('abc')).toBeNull();
    expect(coinsInCurrency(4500)).toBe('4.500 DT');
  });
});
