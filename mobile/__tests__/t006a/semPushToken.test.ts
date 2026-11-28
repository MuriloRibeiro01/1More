/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// T-006a, item 4 (C18) — condições do Leônidas para o expo-notifications (Status de T-006a-treino-ativo-lacunas.md):
//  (1) o app só usa notificação LOCAL: nunca pede token de push (getExpoPushTokenAsync / getDevicePushTokenAsync / addPushTokenListener)
//      e não existe google-services.json (sem FCM, nada sai do aparelho; RNF-01);
//  (3) o texto da notificação é genérico ("Descanso acabou"), sem dado pessoal (testado em notificacaoDescanso.test.tsx).
// Teste de varredura: passa hoje (nada disso existe) e QUEBRA se alguém introduzir push.
const RAIZ = join(__dirname, '..', '..');
const SRC = join(RAIZ, 'src');
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const c = join(dir, n);
    return statSync(c).isDirectory() ? arquivos(c) : /\.(ts|tsx|js)$/.test(n) ? [c] : [];
  });
const fontes = arquivos(SRC).map((c) => ({ rel: relative(SRC, c), codigo: semComentarios(readFileSync(c, 'utf8')) }));

describe('notificação só local (sem push, sem FCM)', () => {
  it('nenhum código do app pede token de push', () => {
    const proibidos = /getExpoPushTokenAsync|getDevicePushTokenAsync|addPushTokenListener|registerForPushNotificationsAsync/;
    expect(fontes.filter((f) => proibidos.test(f.codigo)).map((f) => f.rel)).toEqual([]);
  });

  it('não existe google-services.json no projeto mobile nem referência a ele em app.json', () => {
    expect(existsSync(join(RAIZ, 'google-services.json'))).toBe(false);
    expect(existsSync(join(RAIZ, 'android', 'app', 'google-services.json'))).toBe(false);
    expect(readFileSync(join(RAIZ, 'app.json'), 'utf8')).not.toMatch(/googleServicesFile|google-services/);
  });

  it('nenhum código do app liga notificação remota (setNotificationHandler só para exibir a local; sem listener de push)', () => {
    const remotos = /addNotificationReceivedListener[\s\S]{0,80}remote|registerTaskAsync|getLastNotificationResponse[\s\S]{0,40}push/i;
    expect(fontes.filter((f) => remotos.test(f.codigo)).map((f) => f.rel)).toEqual([]);
  });

  it('o texto genérico da notificação ("Descanso acabou") vem do i18n e não carrega dado pessoal (nome, carga, exercício)', () => {
    const arquivo = fontes.find((f) => f.rel.endsWith(join('i18n', 'locales', 'pt-BR.ts')))!;
    const chave = arquivo.codigo.match(/restDone[^\n]*|notification[^\n]*Descanso acabou[^\n]*|[^\n]*Descanso acabou[^\n]*/);
    expect(chave).not.toBeNull();
    expect(chave![0]).not.toMatch(/\{\{/); // sem interpolação: nada de {{name}}, {{weight}}...
  });
});
