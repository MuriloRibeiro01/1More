/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { colors, radius, size, space, type } from '../src/theme/theme';
import { text } from '../src/theme/text';

const REPO = join(__dirname, '..', '..');

/** Remove espaços/quebras: o .txt do Guia quebra linhas longas e insere rodapés de página. */
function normalizar(src: string): string {
  return src.replace(/\s+/g, '');
}

function themeDoGuia(): string {
  const guia = readFileSync(join(REPO, 'docs', '1More-Guia-React-Native.txt'), 'utf8');
  const inicio = guia.indexOf('export const colors = {');
  const fimType = guia.indexOf('export const type = {');
  const fim = guia.indexOf('} as const;', fimType) + '} as const;'.length;
  expect(inicio).toBeGreaterThan(-1);
  expect(fimType).toBeGreaterThan(inicio);
  return guia
    .slice(inicio, fim)
    .split(/\r?\n/)
    .filter((linha) => !/^1More · Guia React Native \d+\/\d+\s*$/.test(linha))
    .join('\n');
}

function themeDoApp(): string {
  return readFileSync(join(__dirname, '..', 'src', 'theme', 'theme.ts'), 'utf8')
    .split(/\r?\n/)
    .filter((linha) => !linha.trimStart().startsWith('//'))
    .join('\n');
}

describe('theme.ts', () => {
  it('é idêntico ao theme.ts do Guia React Native (fora os comentários)', () => {
    expect(normalizar(themeDoApp())).toBe(normalizar(themeDoGuia()));
  });

  it('Papel e Noite têm exatamente as mesmas chaves de cor', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('respeita as regras do DS: raio máx. 4, alvo de toque 48, linha 56, tab bar 64', () => {
    expect(Math.max(...Object.values(radius))).toBeLessThanOrEqual(4);
    expect(size.sizeTouch).toBe(48);
    expect(size.sizeRow).toBe(56);
    expect(size.sizeTabbar).toBeGreaterThanOrEqual(48);
    expect(space.s4).toBe(16);
  });

  it('nenhum estilo de texto usa fontWeight (peso vem do fontFamily)', () => {
    for (const estilo of Object.values(type)) {
      expect(estilo).not.toHaveProperty('fontWeight');
      expect(estilo.fontFamily).toMatch(/^(RacingSansOne|BarlowCondensed|Barlow|IBMPlexMono)_\d{3}/);
    }
  });

  it('números usam IBM Plex Mono com tabular-nums', () => {
    for (const nome of ['numXl', 'numLg', 'numMd', 'numSm'] as const) {
      expect(type[nome].fontFamily).toMatch(/^IBMPlexMono_/);
      expect(type[nome].fontVariant).toEqual(['tabular-nums']);
    }
  });

  it('text.ts expõe todos os tokens com fontVariant mutável e mesmos valores', () => {
    expect(Object.keys(text).sort()).toEqual(Object.keys(type).sort());
    expect(text.numMd.fontVariant).toEqual(['tabular-nums']);
    expect(text.numMd.fontVariant).not.toBe(type.numMd.fontVariant);
    expect(text.titleLg).toEqual(type.titleLg);
  });
});
