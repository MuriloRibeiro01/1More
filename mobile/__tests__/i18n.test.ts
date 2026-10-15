import { beforeAll, describe, expect, it } from '@jest/globals';
import i18n, { DEFAULT_LOCALE, formatKickerDate, formatNumber, formatSet, formatWeight, resolveLocale } from '../src/i18n';
import en from '../src/i18n/locales/en';
import ptBR from '../src/i18n/locales/pt-BR';

function chaves(obj: object, prefixo = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? chaves(v, `${prefixo}${k}.`) : [`${prefixo}${k}`],
  );
}

describe('resolveLocale', () => {
  it.each<[readonly (string | null | undefined)[], string]>([
    [['en'], 'en'],
    [['EN'], 'en'],
    [['en-US'], 'en'],
    [['pt'], 'pt-BR'],
    [['es'], 'pt-BR'],
    [[], 'pt-BR'],
    [[null, undefined, 'en'], 'en'],
    [['pt', 'en'], 'pt-BR'],
  ])('%p → %s', (codigos, esperado) => {
    expect(resolveLocale(codigos)).toBe(esperado);
  });

  it('padrão é pt-BR', () => {
    expect(DEFAULT_LOCALE).toBe('pt-BR');
  });
});

describe('traduções', () => {
  it('en e pt-BR têm exatamente as mesmas chaves', () => {
    expect(chaves(en).sort()).toEqual(chaves(ptBR).sort());
  });

  it('nenhuma tradução vazia', () => {
    for (const locale of [en, ptBR]) {
      for (const k of chaves(locale)) {
        expect(k.split('.').reduce<any>((o, p) => o[p], locale)).toMatch(/\S/);
      }
    }
  });

  it('abas e temas com os nomes do produto em pt-BR', () => {
    expect(ptBR.tabs).toEqual({ train: 'Treinar', history: 'Histórico', progress: 'Progresso', profile: 'Perfil' });
    expect([ptBR.profile.themeLight, ptBR.profile.themeDark]).toEqual(['Papel', 'Noite']);
  });

  it('a instância resolve chaves e cai para pt-BR em idioma não suportado', async () => {
    await i18n.changeLanguage('pt-BR');
    expect(i18n.t('tabs.train')).toBe('Treinar');
    await i18n.changeLanguage('en');
    expect(i18n.t('tabs.train')).toBe('Train');
    await i18n.changeLanguage('fr');
    expect(i18n.t('tabs.train')).toBe('Treinar');
    await i18n.changeLanguage('pt-BR');
  });
});

describe('formatação pt-BR', () => {
  beforeAll(() => i18n.changeLanguage('pt-BR'));

  it('formatNumber', () => {
    expect(formatNumber(12340)).toBe('12.340');
    expect(formatNumber(82.5)).toBe('82,5');
    expect(formatNumber(82.0)).toBe('82');
    expect(formatNumber(1.255)).toMatch(/^1,2[56]$/);
    expect(formatNumber(2.5, 0)).toMatch(/^[23]$/);
  });

  it('formatWeight', () => {
    expect(formatWeight(82.5)).toBe('82,5 kg');
    expect(formatWeight(12340)).toBe('12.340 kg');
    expect(formatWeight(1.25)).toBe('1,25 kg');
    expect(formatWeight(100, 'lb')).toBe('100 lb');
  });

  it('formatSet usa × e nunca x', () => {
    expect(formatSet(80, 10)).toBe('80 × 10');
    expect(formatSet(82.5, 8)).toBe('82,5 × 8');
    expect(formatSet(80, 10)).not.toContain('x');
  });

  it('formatKickerDate: "QUA · 14 OUT"', () => {
    expect(formatKickerDate(new Date(2026, 9, 14, 12))).toBe('QUA · 14 OUT');
    expect(formatKickerDate(new Date(2026, 0, 4, 12))).toBe('DOM · 4 JAN');
    expect(formatKickerDate(new Date(2026, 4, 2, 12))).toBe('SÁB · 2 MAI');
  });

  it('em inglês os formatadores seguem o idioma ativo', async () => {
    await i18n.changeLanguage('en');
    expect(formatWeight(12340.5)).toBe('12,340.5 kg');
    await i18n.changeLanguage('pt-BR');
  });
});
