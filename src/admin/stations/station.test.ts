import { describe, expect, it } from 'vitest';

import type { Peripheral } from '../../api/types';
import { peripheralName, sortPeripherals } from './station';

const device = (deviceId: string, name: string | null, connected: boolean): Peripheral => ({
  deviceId,
  name,
  vendorProductId: null,
  connected,
  changedAt: null,
});

describe('station peripherals', () => {
  it('labels a device by name, else by its device id', () => {
    expect(peripheralName(device('USB\\VID_046D', 'Mouse', true))).toBe('Mouse');
    expect(peripheralName(device('USB\\VID_046D', '  ', true))).toBe('USB\\VID_046D');
  });

  it('lists disconnected devices first, then by name', () => {
    const list = [device('1', 'Mouse', true), device('2', 'Keyboard', true), device('3', 'Headset', false)];
    expect(sortPeripherals(list).map(peripheralName)).toEqual(['Headset', 'Keyboard', 'Mouse']);
    expect(list.map(peripheralName)).toEqual(['Mouse', 'Keyboard', 'Headset']);
  });
});
