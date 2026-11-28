/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// T-006e, item 6 (S12): o Stepper tem `minWidth: 72` literal, fora dos tokens do theme.ts (CLAUDE.md: "cores/medidas só via theme").
// Regra: nenhuma largura/altura mínima numérica solta nos componentes e telas; use `size.*`/`space.*`.
const SRC = join(__dirname, '..', '..', 'src');
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const c = join(dir, n);
    return statSync(c).isDirectory() ? arquivos(c) : /\.tsx$/.test(n) ? [c] : [];
  });

describe('medidas mínimas só por token', () => {
  it('Stepper.tsx não usa minWidth numérico literal', () => {
    const codigo = semComentarios(readFileSync(join(SRC, 'components', 'Stepper.tsx'), 'utf8'));
    expect(codigo).not.toMatch(/minWidth:\s*\d/);
  });

  it('nenhum componente ou tela tem minWidth/minHeight numérico literal', () => {
    const violacoes = arquivos(SRC)
      .map((c) => ({ rel: relative(SRC, c), codigo: semComentarios(readFileSync(c, 'utf8')) }))
      .filter((f) => /min(Width|Height):\s*\d/.test(f.codigo))
      .map((f) => f.rel);
    expect(violacoes).toEqual([]);
  });
});
