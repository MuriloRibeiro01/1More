// Semana e dia local (RN-24). Datas guardadas em UTC; o dia do treino é a data local de início.

/** Meia-noite local do primeiro dia da semana (padrão segunda; 0 = domingo). Não muta a entrada. */
export function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const back = (date.getDay() - weekStartsOn + 7) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
}

/** 'AAAA-MM-DD' do dia local; `tzOffsetMinutes` = -new Date().getTimezoneOffset(). */
export const localDayKey = (ms: number, tzOffsetMinutes: number) =>
  new Date(ms + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);

/** Dias distintos com treino na semana que começa em `weekStart`. */
export function daysTrainedInWeek(startedAts: number[], weekStart: Date, tzOffsetMinutes: number): number {
  const week = new Set(
    Array.from({ length: 7 }, (_, i) =>
      new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)).toISOString().slice(0, 10),
    ),
  );
  return new Set(startedAts.map((ms) => localDayKey(ms, tzOffsetMinutes)).filter((k) => week.has(k))).size;
}
