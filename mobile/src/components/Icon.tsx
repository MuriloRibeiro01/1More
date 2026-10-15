// Fonte: docs/1More-icones/1more-icons/Icon.tsx (pacote oficial de ícones). Não edite os paths à mão:
// ao atualizar o pacote, copie o arquivo de novo.
import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Ícones 1More — traço de caneta: 2px, pontas retas, cantos vivos, grade 24. */
export const ICON_PATHS = {
  'check': 'M4 12.5l5 5L20 6.5',
  'plus': 'M12 4v16M4 12h16',
  'minus': 'M4 12h16',
  'close': 'M5 5l14 14M19 5L5 19',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-down': 'M5 9l7 7 7-7',
  'timer': 'M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 9v4l3 2M9 2h6',
  'play': 'M7 4.5l12 7.5-12 7.5z',
  'pause': 'M8 5v14M16 5v14',
  'skip': 'M5 5l9 7-9 7zM18 5v14',
  'more': 'M5 12h.01M12 12h.01M19 12h.01',
  'swap': 'M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7',
  'note': 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  'notebook': 'M6 3h13v18H6zM9.5 3v18M13 8h3M13 12h3',
  'calendar': 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  'chart': 'M4 4v16h16M7 15l4-4 3 3 5-6',
  'user': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  'sliders': 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  'sync': 'M20 8a8 8 0 0 0-14.5-1.5M4 4v4h4M4 16a8 8 0 0 0 14.5 1.5M20 20v-4h-4',
  'offline': 'M3 3l18 18M9 18h8a4 4 0 0 0 2-7.5M6.5 9A5 5 0 0 0 7 18',
  'alert': 'M12 4L2.5 20h19zM12 10v4M12 17v.01',
  'trash': 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  'drag': 'M5 9h14M5 15h14',
  'search': 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
  'filter': 'M4 6h16M7 12h10M10 18h4',
  'tally': 'M6 5v14M10 5v14M14 5v14M18 5v14M3 16l18-8',
  'plate': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  'dumbbell': 'M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12',
  'flag': 'M5 21V4M5 4h13l-3 4 3 4H5',
  'download': 'M12 4v11M7 10l5 5 5-5M4 20h16',
  'arrow-up': 'M12 20V5M6 11l6-6 6 6',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  /** Padrão 24 (size-icon). Use 18 (size-icon-sm) em botões compactos. */
  size?: number;
  /** Cor do traço — passe colors[theme].ink ou .inkMuted. */
  color: string;
  strokeWidth?: number;
  /** Rótulo para leitor de tela quando o ícone está sozinho. Sem ele, o ícone é decorativo. */
  accessibilityLabel?: string;
}

export function Icon({ name, size = 24, color, strokeWidth = 2, accessibilityLabel }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      <Path d={ICON_PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="square" strokeLinejoin="miter" />
    </Svg>
  );
}
