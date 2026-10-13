import { useState, type InputHTMLAttributes } from 'react';

import eyeHidden from '../assets/eye-hidden.svg';
import eyeShown from '../assets/eye-shown.svg';
import { ART, Art } from './Art';
import styles from './Field.module.css';
import { Select, type SelectOption } from './Select';

/** A rounded cream field (212 × 40). The placeholder is its label. */
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

/** A dropdown in the field's look (a Select): `label` names it for screen readers, `placeholder` shows until a choice. */
export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  required?: boolean;
}) {
  return <Select look="field" aria-label={label} placeholder={placeholder} value={value} options={options} onChange={onChange} required={required} />;
}
