import { config } from '../config';

/** Red "FAKE DATA" tag in the top bar whenever mocks are on, so nobody demos fake numbers by accident. */
export function MockBadge() {
  if (!config.useMocks) return null;
  const real = config.realPrefixes.length ? ` (real: ${config.realPrefixes.join(', ')})` : '';
  return (
    <span className="mock-badge" title={`Endpoints answered by src/mocks${real}`}>
      FAKE DATA
    </span>
  );
}
