import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

import eyeHidden from '../assets/eye-hidden.svg';
import eyeShown from '../assets/eye-shown.svg';
import selectArrow from '../assets/select-arrow.svg';
import { ART, Art } from './Art';
import styles from './Field.module.css';

/** A rounded cream field (Figma inputs: 212 × 40). The placeholder is its label. */
export function TextField(props: InputHTMLAttributes<HTMLInputElement> & { placeholder: string }) {
  return (
    <div className={styles.root}>
      <input {...props} aria-label={props.placeholder} />
    </div>
  );
}

/** A password field with the eye that shows or hides what is typed. */
export function PasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { placeholder: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.root}>
      <input {...props} type={shown ? 'text' : 'password'} aria-label={props.placeholder} />
      <button
        type="button"
        className={styles.eye}
        onClick={() => setShown(!shown)}
        aria-label={shown ? 'Hide the password' : 'Show the password'}
        aria-pressed={shown}
      >
        {shown ? <Art src={eyeShown} w={ART.eyeShown[0]} h={ART.eyeShown[1]} /> : <Art src={eyeHidden} w={ART.eyeHidden[0]} h={ART.eyeHidden[1]} />}
      </button>
    </div>
  );
}

/** A dropdown styled as a field, with the design's arrow. The first option is the placeholder. */
export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <div className={styles.root}>
      <select {...props} aria-label={label} className={props.value ? undefined : styles.empty}>
        {children}
      </select>
      <Art className={styles.arrow} src={selectArrow} w={ART.selectArrow[0]} h={ART.selectArrow[1]} />
    </div>
  );
}
