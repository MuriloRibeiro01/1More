import { describe, expect, it } from '@jest/globals';
import { parseReps, roundKg } from '../src/routines/rules';

describe('parseReps', () => {
  it.each<[string, number | null | undefined]>([
    ['', null],
    ['  ', null],
    ['8', 8],
    [' 12 ', 12],
    ['0', undefined],
    ['-3', undefined],
    ['8,5', undefined],
    ['abc', undefined],
  ])('%p → %p', (texto, esperado) => {
    expect(parseReps(texto)).toBe(esperado);
  });
});

describe('roundKg', () => {
  it('arredonda para 2 casas sem erro de ponto flutuante', () => {
    expect(roundKg(82.555)).toBe(82.56);
    expect(roundKg(1.005)).toBe(1.01);
    expect(roundKg(60)).toBe(60);
  });
});
