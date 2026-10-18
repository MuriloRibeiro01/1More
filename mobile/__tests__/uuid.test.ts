import { describe, expect, it } from '@jest/globals';
import { uuidv7 } from '../src/db/uuid';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('gera o formato v7 (versão 7, variante RFC 9562)', () => {
    expect(uuidv7()).toMatch(UUID_V7);
  });

  it('os 48 bits iniciais são o timestamp em ms', () => {
    const now = 4_000_000_000_123;
    const id = uuidv7(now);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(now);
  });

  it('é crescente mesmo dentro do mesmo milissegundo, e não repete', () => {
    const ids = Array.from({ length: 2000 }, () => uuidv7(4_000_000_001_000));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('relógio que volta não quebra a ordem', () => {
    const a = uuidv7(4_000_000_002_500);
    const b = uuidv7(4_000_000_002_100);
    expect(b > a).toBe(true);
  });
});
