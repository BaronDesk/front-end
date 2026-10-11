import { groupThousands } from '../../shared/lib/format';
import coin from './assets/coin.png';
import walletFront from './assets/wallet-front.png';
import { ART, Art, u } from './units';

/** The card's box on the Figma Profile screen (px): it starts at the big coin's top, above the wallet. */
const BOX = { left: 28, top: 266 };

/**
 * The three coins tucked in the wallet, as drawn: center (Figma px), size and
 * tilt. Figma places a rotated layer by the corner it turns around; these are
 * the centers that gives.
 */
const COINS = [
  { x: 128.97, y: 331.2, size: 86.069, turn: 17.47 },
  { x: 228.0, y: 332.0, size: 64.908, turn: -111.25 },
  { x: 180.48, y: 326.03, size: 119.975, turn: -15.75 },
];

/** Figma px on the Profile screen → px inside the card's box. */
const at = (x: number, y: number) => ({ left: u(x - BOX.left), top: u(y - BOX.top) });

/** The wallet with its coins and the balance ("30.000"), as on Profile; Wallet shows it too. */
export function WalletCard({ balance }: { balance: number | undefined }) {
  return (
    <div className="bd-wallet" aria-label={balance === undefined ? 'Wallet' : `Balance: ${balance} coins`}>
      <span className="bd-wallet-back" style={at(28, 299)} />
      {COINS.map((c, i) => (
        <span key={i} className="bd-wallet-coin" style={{ ...at(c.x - c.size / 2, c.y - c.size / 2), width: u(c.size), height: u(c.size) }}>
          <img src={coin} alt="" style={{ width: u(c.size), height: u(c.size), transform: `rotate(${c.turn}deg)` }} />
        </span>
      ))}
      <Art className="bd-wallet-front" src={walletFront} w={ART.walletFront[0]} h={ART.walletFront[1]} style={at(44, 315.92)} />
      <p className="bd-wallet-label" style={at(61, 357)}>
        Total Balance
      </p>
      <p className="bd-wallet-balance" style={at(60, 375)}>
        {balance === undefined ? '…' : groupThousands(balance)}
      </p>
    </div>
  );
}
