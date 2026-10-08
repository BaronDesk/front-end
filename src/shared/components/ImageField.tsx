import { useState, type ChangeEvent } from 'react';

import { IMAGE_ACCEPT } from '../../api/images';
import { explainRefusal } from '../lib/errors';
import { IMAGE_REFUSALS, imageProblem } from '../lib/images';
import { ErrorBox } from './ErrorBox';
import { Thumb } from './Thumb';

interface ImageFieldProps {
  id: string;
  label: string;
  /** The current link (badgeUrl, iconUrl, avatarUrl), or null. */
  value: string | null;
  /** Stores the picked file and answers its link: uploadImage, or the avatar call. */
  upload: (file: File) => Promise<string | null>;
  /** The new link, after an upload or Remove. */
  onChange: (url: string | null) => void;
  /** Remove with a server call (the avatar). Without it, Remove only clears the value, saved with the form. */
  remove?: () => Promise<unknown>;
  /** True while a file is sent: keep the form's Save disabled meanwhile. */
  onBusy?: (busy: boolean) => void;
  round?: boolean;
}

/**
 * An image in a form: the current one, a file picker that uploads at once,
 * and Remove. PNG, JPEG or WebP, at most 2 MB (checked here, then by the server).
 */
export function ImageField({ id, label, value, upload, onChange, remove, onBusy, round }: ImageFieldProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function work(task: () => Promise<void>) {
    setBusy(true);
    onBusy?.(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still fires
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) {
      setError(new Error(problem));
      return;
    }
    void work(async () => onChange(await upload(file).catch((err) => explainRefusal(err, IMAGE_REFUSALS))));
  }

  function clear() {
    void work(async () => {
      await remove?.();
      onChange(null);
    });
  }

  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <span className="image-field">
        {value ? <Thumb url={value} size={48} round={round} alt={label} /> : <span className="muted">none</span>}
        <input id={id} type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={pick} />
        {value && (
          <button type="button" className="secondary" disabled={busy} onClick={clear}>
            Remove
          </button>
        )}
        {busy && <span className="muted">Sending…</span>}
      </span>
      <ErrorBox error={error} />
    </div>
  );
}
