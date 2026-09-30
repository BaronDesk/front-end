import { describe, expect, it } from 'vitest';

import { dinarsToMillimes, formatMillimes, formatMoney, formatSignedMillimes, millimesToDinars } from './format';

describe('money: dinars on screen, integer millimes on the wire', () => {
  it('parses a form value into millimes', () => {
    expect(dinarsToMillimes('4.5')).toBe(4500);
    expect(dinarsToMillimes('2,750')).toBe(2750);
    expect(dinarsToMillimes('0.0004')).toBe(0);
    expect(dinarsToMillimes('')).toBeNull();
    expect(dinarsToMillimes('abc')).toBeNull();
  });

  it('formats what the server sent', () => {
    expect(formatMillimes(4000)).toBe('4.000 DT');
    expect(formatMillimes(null)).toBe('—');
    expect(formatSignedMillimes(10000)).toBe('+10.000 DT');
    expect(formatSignedMillimes(-1500)).toBe('-1.500 DT');
    expect(millimesToDinars(2750)).toBe('2.750');
  });

  it('formats the backend Decimal columns (plan prices come as strings)', () => {
    expect(formatMoney('15')).toBe('15.000 DT');
    expect(formatMoney(4.5)).toBe('4.500 DT');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney('abc')).toBe('—');
  });
});
