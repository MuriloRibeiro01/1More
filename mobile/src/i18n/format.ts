import i18n from './instance';

// Formatação de números/datas pelo idioma ativo (pt-BR por padrão): 82,5 kg · 12.340 kg · 80 × 10.

function locale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'pt-BR';
}

/** Número com até `maxDecimals` casas, sem zeros à direita (82,5 · 12.340). */
export function formatNumber(value: number, maxDecimals = 2, loc: string = locale()): string {
  return new Intl.NumberFormat(loc, { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals }).format(value);
}

/** Carga sempre armazenada em kg com 2 casas (RN-13). */
export function formatWeight(kg: number, unit = 'kg', loc: string = locale()): string {
  return `${formatNumber(kg, 2, loc)} ${unit}`;
}

/** Carga × reps com o sinal de multiplicação, nunca "x". */
export function formatSet(weight: number, reps: number, loc: string = locale()): string {
  return `${formatNumber(weight, 2, loc)} × ${formatNumber(reps, 0, loc)}`;
}

/** Linha de contexto do TopBar: "QUA · 14 OUT". */
export function formatKickerDate(date: Date, loc: string = locale()): string {
  const clean = (s: string) => s.replace(/\./g, '').toUpperCase();
  const weekday = clean(new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(date));
  const day = new Intl.DateTimeFormat(loc, { day: 'numeric' }).format(date);
  const month = clean(new Intl.DateTimeFormat(loc, { month: 'short' }).format(date));
  return `${weekday} · ${day} ${month}`;
}
