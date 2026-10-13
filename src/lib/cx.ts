/** Joins class names, skipping the empty ones: cx(styles.root, on && styles.on, className). */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
