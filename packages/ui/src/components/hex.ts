const HEX = /^#?([0-9a-f]{6})$/i;
const SHORT_HEX = /^#?([0-9a-f]{3})$/i;

/** Normalises user text to `#rrggbb`, or null when invalid. */
export function normalizeHex(input: string): string | null {
  const s = input.trim();
  const long = HEX.exec(s);
  if (long) return `#${(long[1] as string).toLowerCase()}`;
  const short = SHORT_HEX.exec(s);
  if (short) {
    const [a, b, c] = (short[1] as string).toLowerCase();
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return null;
}
