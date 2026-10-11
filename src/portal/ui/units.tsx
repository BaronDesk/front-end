import type { CSSProperties, ImgHTMLAttributes } from 'react';

/**
 * A design length (px on the 360 px Figma screen) in the portal's unit
 * (--u, 1/360 of the column): the layout scales with the phone.
 */
export const u = (px: number): string => `calc(${px} * var(--u))`;

/**
 * A static design image at its Figma size, scaled like the rest. Its SVG's
 * own width/height are in px and would not scale, so the size is set here.
 */
export function Art({ src, w, h, style, alt = '', ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string; w: number; h: number }) {
  const size: CSSProperties = { width: u(w), height: u(h), ...style };
  return <img src={src} alt={alt} style={size} draggable={false} {...rest} />;
}

/** The Figma size of each SVG in assets/ (its root width × height). */
export const ART = {
  manette: [64.015, 78.0591],
  gamerScribble: [54.3839, 65.0616],
  homeIcon: [22.125, 22.125],
  userIcon: [22.7505, 23.5662],
  bookingIcon: [16.75, 23.5595],
  settingsIcon: [23.9897, 23.9864],
  largeLogo: [156.013, 63.9949],
  bidiWelcome: [255.501, 313.055],
  bidiForm: [171.314, 232],
  eyeHidden: [14.124, 11.5],
  eyeShown: [13.8333, 10.3262],
  selectArrow: [11.2773, 8.54699],
  authBlob: [558.422, 540.654],
  authOutline: [879.867, 851.871],
} as const;
