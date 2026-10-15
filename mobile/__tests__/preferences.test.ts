import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import type { Database } from '@nozbe/watermelondb';
import { loadThemePreference, saveThemePreference } from '../src/db/preferences';

/** Banco falso: só o LocalStorage do WatermelonDB, que é o que preferences.ts usa. */
type Fn = (...args: unknown[]) => Promise<unknown>;

function bancoCom(get: Mock<Fn>, set: Mock<Fn> = jest.fn<Fn>().mockResolvedValue(undefined)) {
  return { db: { localStorage: { get, set } } as unknown as Database, get, set };
}

describe('preferência de tema no LocalStorage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['system', 'light', 'dark'])('devolve o valor salvo válido: %s', async (valor) => {
    const { db } = bancoCom(jest.fn<Fn>().mockResolvedValue(valor));
    await expect(loadThemePreference(db)).resolves.toBe(valor);
  });

  it.each<unknown>([undefined, null, '', 'noite', 'papel', 'DARK', 42, {}])('valor inválido %p → system', async (valor) => {
    const { db } = bancoCom(jest.fn<Fn>().mockResolvedValue(valor));
    await expect(loadThemePreference(db)).resolves.toBe('system');
  });

  it('erro na leitura → system, sem quebrar a abertura do app', async () => {
    const { db } = bancoCom(jest.fn<Fn>().mockRejectedValue(new Error('disco')));
    await expect(loadThemePreference(db)).resolves.toBe('system');
  });

  it('salva sempre na mesma chave que a leitura usa', async () => {
    const { db, get, set } = bancoCom(jest.fn<Fn>().mockResolvedValue('dark'));
    await saveThemePreference(db, 'dark');
    await loadThemePreference(db);
    expect(set).toHaveBeenCalledWith(expect.anything(), 'dark');
    expect(get).toHaveBeenCalledWith(set.mock.calls[0][0]);
  });

  it('erro ao salvar não propaga (só registra aviso)', async () => {
    const { db } = bancoCom(jest.fn<Fn>(), jest.fn<Fn>().mockRejectedValue(new Error('cheio')));
    await expect(saveThemePreference(db, 'light')).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });
});
