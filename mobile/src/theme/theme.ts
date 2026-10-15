// Cópia literal do theme.ts do "Guia React Native" (gerado de tokens.json do Design System 1More).
// tokens.json ainda não está no repositório: até chegar, um token novo exige copiar o arquivo do Guia
// de novo, nunca editar valores soltos aqui.
export const colors = {
  light: {
    paper: '#f1e8d6',
    paperRaised: '#faf5ea',
    paperSunk: '#e5dac3',
    rule: '#c9c2b0',
    marginLine: '#e0844f',
    line: '#d9cdb4',
    lineStrong: '#7d7462',
    ink: '#1a1917',
    inkMuted: '#5c5549',
    inkFaint: '#a89f8d',
    onInk: '#faf5ea',
    hugger: '#a33b10',
    onHugger: '#faf5ea',
    grabber: '#1d5a85',
    onGrabber: '#faf5ea',
    doneWash: '#dfe6ea',
    stripe: '#f2bb3d',
    onStripe: '#1a1917',
    stripeWash: '#f6d27f',
    focus: '#1d5a85',
    link: '#1d5a85',
    scrim: 'rgba(28, 33, 48, 0.48)',
  },
  dark: {
    paper: '#17161a',
    paperRaised: '#211f24',
    paperSunk: '#2b2830',
    rule: '#34313a',
    marginLine: '#7a3a1c',
    line: '#37333c',
    lineStrong: '#8c8478',
    ink: '#f1e8d6',
    inkMuted: '#b5ab98',
    inkFaint: '#5d5864',
    onInk: '#17161a',
    hugger: '#ff8c4a',
    onHugger: '#17161a',
    grabber: '#7cc0f0',
    onGrabber: '#17161a',
    doneWash: '#1d2730',
    stripe: '#f2bb3d',
    onStripe: '#17161a',
    stripeWash: '#3d3218',
    focus: '#7cc0f0',
    link: '#7cc0f0',
    scrim: 'rgba(0, 0, 0, 0.64)',
  },
} as const;
export type ThemeName = keyof typeof colors;
export type Colors = typeof colors.light;
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
} as const;
export const radius = {
  radius0: 0,
  radius1: 2,
  radius2: 4,
} as const;
export const border = {
  borderHair: 1,
  borderPen: 2,
  borderDouble: 4,
} as const;
export const size = {
  sizeTouch: 48,
  sizeRow: 56,
  sizeRule: 28,
  sizeMargin: 44,
  sizeTabbar: 64,
  sizeIcon: 24,
  sizeIconSm: 18,
} as const;
export const type = {
  displayXl: { fontFamily: 'RacingSansOne_400Regular', fontSize: 48, lineHeight: 50, letterSpacing: 0.48, textTransform: 'uppercase' },
  titleLg: { fontFamily: 'RacingSansOne_400Regular', fontSize: 32, lineHeight: 34, letterSpacing: 0.64, textTransform: 'uppercase' },
  titleMd: { fontFamily: 'RacingSansOne_400Regular', fontSize: 22, lineHeight: 26, letterSpacing: 0.66, textTransform: 'uppercase' },
  button: { fontFamily: 'RacingSansOne_400Regular', fontSize: 18, lineHeight: 20, letterSpacing: 0.72, textTransform: 'uppercase' },
  label: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: 'uppercase' },
  bodyLg: { fontFamily: 'Barlow_500Medium', fontSize: 18, lineHeight: 26, letterSpacing: 0 },
  body: { fontFamily: 'Barlow_400Regular', fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  caption: { fontFamily: 'Barlow_500Medium', fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  numXl: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 56, lineHeight: 56, letterSpacing: -1.12, fontVariant: ['tabular-nums'] },
  numLg: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 28, lineHeight: 32, letterSpacing: 0, fontVariant: ['tabular-nums'] },
  numMd: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 20, lineHeight: 24, letterSpacing: 0, fontVariant: ['tabular-nums'] },
  numSm: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 14, lineHeight: 20, letterSpacing: 0, fontVariant: ['tabular-nums'] },
} as const;
