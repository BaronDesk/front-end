import { describe, expect, it } from 'vitest';

import type { Peripheral } from '../../api/types';
import { commandErrorHint, peripheralName, shutdownConfirmText, sortPeripherals } from './station';

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

describe('station commands wording', () => {
  it('says a running session is billed up to now on shut down', () => {
    expect(shutdownConfirmText('PC-01', true)).toContain('billed up to this moment');
    expect(shutdownConfirmText('PC-01', false)).not.toContain('session');
    expect(shutdownConfirmText('3 stations', true, 3)).toBe(
      'Shut down 3 stations? Anyone playing on them stops now: their session is ended and billed up to this moment. The PCs power off and come back only when someone switches them on.',
    );
  });

  it('explains the unlock refusals and leaves other codes to the server', () => {
    expect(commandErrorHint('NO_SESSION_TO_UNLOCK', 'PC-01')).toContain('PIN');
    expect(commandErrorHint('INSUFFICIENT_FUNDS', 'PC-01')).toContain('Top up');
    expect(commandErrorHint('STATION_OFFLINE', 'PC-01')).toBeNull();
  });
});
