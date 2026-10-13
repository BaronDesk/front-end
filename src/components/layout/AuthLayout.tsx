import type { FormEvent, ReactNode } from 'react';

import blob from '../assets/auth-blob.svg';
import bidiForm from '../assets/bidi-form.svg';
import bidiWelcome from '../assets/bidi-welcome.svg';
import outline from '../assets/auth-outline.svg';
import largeLogo from '../assets/large-logo.svg';
import { ART, Art, u } from '../primitives/Art';
import { Notice } from '../primitives/Notice';
import { describeError } from '../../lib/errors';
import { cx } from '../../lib/cx';
import styles from './AuthLayout.module.css';

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

const BLOB = { w: ART.authBlob[0], h: ART.authBlob[1] };
const OUTLINE = { w: ART.authOutline[0], h: ART.authOutline[1] };

/**
 * The signed-out screens (welcome, login, sign-up): the gradient with its
 * shapes, and a 360 × 696 stage laid out as drawn, centered on the phone.
 */
/** `wide`: a desktop window (the desk): the design fills it, the stage stays in the middle. */
export function AuthScreen({ variant, wide = false, children }: { variant: keyof typeof SHAPES; wide?: boolean; children: ReactNode }) {
  const { left, right } = SHAPES[variant];
  return (
    <div className="bd-stage">
      <div className={cx('bd-app', styles.root, wide && styles.wide)}>
        <div className={styles.shapes} aria-hidden="true">
          {/* Anchored to the corner each one decorates, so they stay there on any phone. */}
          <Art src={blob} w={BLOB.w} h={BLOB.h} style={{ left: u(left[0] - BLOB.w / 2), top: u(left[1] - BLOB.h / 2), transform: 'rotate(-10.25deg)' }} />
          <Art src={blob} w={BLOB.w} h={BLOB.h} style={{ right: u(360 - right[0] - BLOB.w / 2), top: u(right[1] - BLOB.h / 2), transform: 'rotate(22.74deg)' }} />
          <Art
            src={outline}
            w={OUTLINE.w}
            h={OUTLINE.h}
            style={{ left: `calc(50% + ${u(OUTLINE_CENTER[0] - 180 - OUTLINE.w / 2)})`, bottom: u(696 - OUTLINE_CENTER[1] - OUTLINE.h / 2), transform: 'rotate(165deg)' }}
          />
        </div>
        <div className={styles.stage}>{children}</div>
      </div>
    </div>
  );
}

/** The BaronDesk logo, at its place on the screen (102 px from the left on the welcome screen, 103 on the forms). */
export function AuthLogo({ top, left = 103 }: { top: number; left?: number }) {
  return <Art className={styles.logo} src={largeLogo} w={ART.largeLogo[0]} h={ART.largeLogo[1]} alt="BaronDesk" style={{ top: u(top), left: u(left) }} />;
}

/** A refusal under the form, in the charter's red. */
export function AuthError({ error, text }: { error?: unknown; text?: string }) {
  if (!error && !text) return null;
  return (
    <Notice tone="error" align="center" className={styles.error}>
      {text ?? describeError(error).message}
    </Notice>
  );
}

/** BIDI, the mascot: big on the welcome screen (at 52, 168), smaller above a form (at 95, `top`). */
export function AuthMascot({ variant, top = 168 }: { variant: 'welcome' | 'form'; top?: number }) {
  const [src, [w, h], left] = variant === 'welcome' ? [bidiWelcome, ART.bidiWelcome, 52] : [bidiForm, ART.bidiForm, 95];
  return <Art className={styles.mascot} src={src} w={w} h={h} style={{ left: u(left), top: u(top) }} />;
}

/** The form of a signed-out screen: a 212 px column, centered, `top` px from the top. */
export function AuthForm({ top, onSubmit, children }: { top: number; onSubmit(e: FormEvent<HTMLFormElement>): void; children: ReactNode }) {
  return (
    <form className={styles.form} style={{ top: u(top) }} onSubmit={onSubmit}>
      {children}
    </form>
  );
}

/** The form's fields, one under the other, `gap` px apart (or spaced by className). */
export function AuthFields({ gap, className, children }: { gap?: number; className?: string; children: ReactNode }) {
  return (
    <div className={cx(styles.fields, className)} style={gap === undefined ? undefined : { gap: u(gap) }}>
      {children}
    </div>
  );
}
