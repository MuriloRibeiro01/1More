import { describe, expect, it } from '@jest/globals';
import { contrastRatio } from '../../src/theme/contrast';
import { colors } from '../../src/theme';

// T-006a (e) do Sérgio: `contrastRatio` tinha só um teste indireto e o ramo "lápis vira tinta" nunca disparava com as cores atuais.
// Aqui: o cálculo WCAG com valores conhecidos; formatos de cor que não são #rrggbb nunca devolvem NaN em silêncio
// (ou entende o formato, ou lança). O ramo da tela está em contrasteRamo.test.tsx.
describe('contrastRatio (WCAG 2.x)', () => {
  it('preto sobre branco é 21:1 e a ordem dos argumentos não importa', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('cor igual é 1:1', () => {
    expect(contrastRatio('#5c5549', '#5c5549')).toBeCloseTo(1, 5);
  });

  it('valores conhecidos do tema: tinta e lápis sobre a faixa nos dois temas', () => {
    expect(contrastRatio(colors.light.ink, colors.light.stripeWash)).toBeCloseTo(12.08, 1);
    expect(contrastRatio(colors.light.inkMuted, colors.light.stripeWash)).toBeCloseTo(5.07, 1);
    expect(contrastRatio(colors.dark.ink, colors.dark.stripeWash)).toBeCloseTo(10.34, 1);
    expect(contrastRatio(colors.dark.inkMuted, colors.dark.stripeWash)).toBeCloseTo(5.54, 1);
  });

  it('cinza médio sobre branco fica perto do limite de 4,5:1 (#767676 → 4,54)', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5 + 0.1);
  });

  it.each(['#fff', '#FFFFFF', 'rgb(255, 255, 255)', 'branco', ''])('formato "%s": entende ou lança, nunca devolve NaN em silêncio', (formato) => {
    let r: number | undefined;
    try {
      r = contrastRatio(formato, '#000000');
    } catch {
      return; // recusar é aceitável
    }
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBeGreaterThan(1);
  });
});
