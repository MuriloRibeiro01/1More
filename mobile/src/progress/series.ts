import { roundKg } from '../routines/rules';
import { epley1RM, setVolume } from '../workout/rules';
import type { ExerciseSession } from '../workout/sessions';

// Séries do gráfico de Progresso (RF-44). Puras: uma sessão = um ponto.

export type Metric = 'oneRm' | 'bestSet' | 'volume';

export interface SeriesPoint {
  /** Início do treino (ms, UTC). */
  x: number;
  y: number;
  workoutId: string;
  /** Supera todos os pontos anteriores (o primeiro nunca é recorde: não há o que superar). */
  record: boolean;
}

function valueOf(session: ExerciseSession, metric: Metric): number | null {
  if (metric === 'volume') return roundKg(session.sets.reduce((sum, s) => sum + setVolume(s), 0));
  if (metric === 'bestSet') return Math.max(...session.sets.map((s) => s.weightKg ?? 0));
  const estimates = session.sets.map((s) => epley1RM(s.weightKg ?? 0, s.reps ?? 0)).filter((v): v is number => v !== null);
  return estimates.length ? Math.max(...estimates) : null; // RN-10: acima de 12 reps não há 1RM
}

export function metricSeries(sessions: ExerciseSession[], metric: Metric): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  let best = -Infinity;
  for (const s of sessions) {
    const y = valueOf(s, metric);
    if (y === null) continue;
    points.push({ x: s.startedAt, y, workoutId: s.workoutId, record: points.length > 0 && y > best });
    best = Math.max(best, y);
  }
  return points;
}

export interface ChartArea {
  width: number;
  height: number;
  pad: number;
}

/** Converte (x tempo, y valor) em pixels: x proporcional ao tempo, y invertido. Um ponto/valores iguais ficam no centro. */
export function scalePoints<T extends { x: number; y: number }>(points: T[], { width, height, pad }: ChartArea) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  return points.map((p) => ({
    ...p,
    px: x1 === x0 ? width / 2 : pad + ((p.x - x0) / (x1 - x0)) * w,
    py: y1 === y0 ? height / 2 : pad + (1 - (p.y - y0) / (y1 - y0)) * h,
  }));
}
