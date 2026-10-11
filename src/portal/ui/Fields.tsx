import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

import eyeHidden from './assets/eye-hidden.svg';
import selectArrow from './assets/select-arrow.svg';

/** A rounded cream field (Figma inputs: 212 × 40). The placeholder is its label. */
export function TextField(props: InputHTMLAttributes<HTMLInputElement> & { placeholder: string }) {
  return (
    <div className="bd-field">
      <input {...props} aria-label={props.placeholder} />
    </div>
  );
}

/** A password field with the eye that shows or hides what is typed. */
export function PasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { placeholder: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="bd-field">
      <input {...props} type={shown ? 'text' : 'password'} aria-label={props.placeholder} />
      <button
        type="button"
        className="bd-field-eye"
        onClick={() => setShown(!shown)}
        aria-label={shown ? 'Hide the password' : 'Show the password'}
        aria-pressed={shown}
      >
        <img src={eyeHidden} alt="" />
      </button>
    </div>
  );
}

/** A dropdown styled as a field, with the design's arrow. The first option is the placeholder. */
export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <div className="bd-field">
      <select {...props} aria-label={label} className={props.value ? undefined : 'bd-field-empty'}>
        {children}
      </select>
      <img className="bd-field-arrow" src={selectArrow} alt="" />
    </div>
  );
}
