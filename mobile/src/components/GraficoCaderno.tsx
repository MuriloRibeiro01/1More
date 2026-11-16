import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { border, space, useTheme } from '../theme';
import { scalePoints } from '../progress/series';

export interface GraficoPoint {
  x: number;
  y: number;
  record?: boolean;
}

export interface GraficoCadernoProps {
  points: GraficoPoint[];
  /** Descrição falada: o gráfico é uma imagem para o leitor de tela. */
  label: string;
  height?: number;
}

const DEFAULT_WIDTH = 320;

/** Gráfico desenhado direto na folha: linha de tinta, sem moldura nem grade; o recorde em laranja (hugger). */
export function GraficoCaderno({ points, label, height = 160 }: GraficoCadernoProps) {
  const { colors: c } = useTheme();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(1, Math.round(e.nativeEvent.layout.width)));

  const scaled = scalePoints(points, { width, height, pad: space.s4 });
  const d = scaled.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={onLayout} style={styles.root}>
      <Svg width={width} height={height}>
        {scaled.length > 1 ? <Path d={d} stroke={c.ink} strokeWidth={border.borderPen} strokeLinejoin="miter" fill="none" /> : null}
        {scaled.map((p) => (
          <Circle key={p.x} cx={p.px} cy={p.py} r={p.record ? 6 : 4} fill={p.record ? c.hugger : c.ink} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ root: { alignSelf: 'stretch' } });
