import { imageSrc } from '../../api/images';
import bidiHead from './assets/avatar-bidi.svg';

/** The gamer's picture in a ringed circle; BIDI's head until they upload one. */
export function Avatar({ url, size }: { url: string | null | undefined; size: number }) {
  const photo = imageSrc(url);
  return (
    <span className="bd-avatar" style={{ width: size, height: size }}>
      {photo ? <img className="bd-avatar-photo" src={photo} alt="" /> : <img className="bd-avatar-bidi" src={bidiHead} alt="" />}
    </span>
  );
}
