interface PlaceholderProps {
  title: string;
  step: number;
  note?: string;
}

/** Stand-in for a page that a later plan step builds. */
export function Placeholder({ title, step, note }: PlaceholderProps) {
  return (
    <>
      <h1>{title}</h1>
      <div className="msg">
        Not built yet. Comes in <b>step {step}</b> of the Frontend Implementation Plan.
        {note && <div className="muted">{note}</div>}
      </div>
    </>
  );
}
