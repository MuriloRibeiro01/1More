/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Rede de segurança além do ESLint: varre o código-fonte do app atrás de violações do Design System.
const SRC = join(__dirname, '..', 'src');
const THEME = join('theme', 'theme.ts');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const fontes = arquivos(SRC).map((caminho) => ({
  rel: relative(SRC, caminho),
  codigo: semComentarios(readFileSync(caminho, 'utf8')),
}));

describe('regras do Design System no código', () => {
  it('nenhuma cor literal (hex/rgb/hsl) fora de theme.ts', () => {
    const violacoes = fontes
      .filter((f) => f.rel !== THEME && !f.rel.endsWith(join('components', 'Icon.tsx')))
      .filter((f) => /['"`]#[0-9a-fA-F]{3,8}['"`]|\b(rgb|hsl)a?\(/.test(f.codigo))
      .map((f) => f.rel);
    expect(violacoes).toEqual([]);
  });

  it('nenhum fontWeight', () => {
    expect(fontes.filter((f) => /\bfontWeight\b/.test(f.codigo)).map((f) => f.rel)).toEqual([]);
  });

  it('nenhuma sombra difusa nem gradiente', () => {
    const violacoes = fontes
      .filter((f) => /\b(elevation|shadowRadius|shadowOpacity|LinearGradient)\b/.test(f.codigo))
      .map((f) => f.rel);
    expect(violacoes).toEqual([]);
  });

  it('nenhum borderRadius literal acima de 4 (raio máx. do DS)', () => {
    const violacoes = fontes.flatMap((f) =>
      [...f.codigo.matchAll(/borderRadius:\s*(\d+)/g)].filter((m) => Number(m[1]) > 4).map(() => f.rel),
    );
    expect(violacoes).toEqual([]);
  });
});
