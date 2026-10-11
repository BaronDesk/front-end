import type { ReactNode } from 'react';

import blob from './assets/auth-blob.svg';
import outline from './assets/auth-outline.svg';
import largeLogo from './assets/large-logo.svg';
import { describeError } from '../../shared/lib/errors';
import './portal.css';

/**
 * Where the background shapes sit on the 360 × 696 Figma screens: each
 * layer's center and rotation. The red blob is drawn twice (top left, top
 * right); the brown outline once, mostly below the screen.
 */
const SHAPES = {
  welcome: { left: [-172.5, -51.0], right: [597.0, -151.8] },
  form: { left: [-112.2, -155.3], right: [628.0, -157.8] },
} as const;
const OUTLINE_CENTER = [277.2, 975.2];

const BLOB = { w: 558.422, h: 540.654 };
const OUTLINE = { w: 879.867, h: 851.871 };

/**
 * The signed-out screens (welcome, login, sign-up): the gradient with its
 * shapes, and a 360 × 696 stage laid out as drawn, centered on the phone.
 */
export function AuthScreen({ variant, children }: { variant: keyof typeof SHAPES; children: ReactNode }) {
  const { left, right } = SHAPES[variant];
  return (
    <div className="bd-stage">
      <div className="bd-app bd-auth">
        <div className="bd-auth-shapes" aria-hidden="true">
          {/* Anchored to the corner each one decorates, so they stay there on any phone. */}
          <img src={blob} alt="" style={{ left: left[0] - BLOB.w / 2, top: left[1] - BLOB.h / 2, transform: 'rotate(-10.25deg)' }} />
          <img src={blob} alt="" style={{ right: 360 - right[0] - BLOB.w / 2, top: right[1] - BLOB.h / 2, transform: 'rotate(22.74deg)' }} />
          <img
            src={outline}
            alt=""
            style={{ left: `calc(50% - 180px + ${OUTLINE_CENTER[0] - OUTLINE.w / 2}px)`, bottom: 696 - OUTLINE_CENTER[1] - OUTLINE.h / 2, transform: 'rotate(165deg)' }}
          />
        </div>
        <div className="bd-auth-stage">{children}</div>
      </div>
    </div>
  );
}

/** The BaronDesk logo, at its place on the screen (102 px from the left on the welcome screen, 103 on the forms). */
export function AuthLogo({ top, left = 103 }: { top: number; left?: number }) {
  return <img className="bd-auth-logo" src={largeLogo} alt="BaronDesk" style={{ top, left }} />;
}

/** A refusal under the form, in the charter's red. */
export function AuthError({ error, text }: { error?: unknown; text?: string }) {
  if (!error && !text) return null;
  return (
    <p className="bd-auth-error" role="alert">
      {text ?? describeError(error).message}
    </p>
  );
}
