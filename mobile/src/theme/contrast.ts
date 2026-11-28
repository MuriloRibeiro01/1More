/** Lê #rgb ou #rrggbb e devolve [r, g, b] de 0 a 255. Qualquer outro formato lança (nunca NaN em silêncio). */
function parseColor(color: string): [number, number, number] {
  const value = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) return [short[1], short[2], short[3]].map((h) => parseInt(h + h, 16)) as [number, number, number];
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (long) return [long[1], long[2], long[3]].map((h) => parseInt(h, 16)) as [number, number, number];
  throw new Error(`cor não reconhecida: "${color}" (use #rgb ou #rrggbb)`);
}

/** Razão de contraste WCAG entre duas cores. */
export function contrastRatio(a: string, b: string): number {
  const lum = (color: string) => {
    const [r, g, bl] = parseColor(color)
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
