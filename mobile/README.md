# 1More — app mobile

Expo (SDK 57, dev client) + TypeScript + WatermelonDB. Offline-first: a UI lê e grava só no banco local;
o sync roda em segundo plano (`src/sync`, tarefa própria).

## Rodar

```bash
npm install
npm run android        # 1ª vez / após mudar dependência nativa: gera android/ e instala o dev client
npx expo start         # depois: só o Metro; abre no dev client já instalado
npm run typecheck && npm run lint && npm test
```

O app **não roda no Expo Go**: WatermelonDB é módulo nativo, então precisa do dev client.
`android/` e `ios/` são gerados (`expo prebuild`) e não são versionados.

## Estrutura

| Pasta | O que tem |
|-------|-----------|
| `src/theme` | `theme.ts` copiado do Guia RN (não edite à mão; `tokens.json` ainda não está no repo), `ThemeProvider` (Papel/Noite/sistema), `text` (estilos tipados), `useOneMoreFonts` |
| `src/components` | Componentes do Design System com os mesmos nomes e props (`onClick` do web → `onPress`) |
| `src/navigation` | Abas fixas Treinar · Histórico · Progresso · Perfil (RNF-08) com o `TabBar` próprio |
| `src/screens` | Telas |
| `src/db` | WatermelonDB: `schema.ts`, `migrations.ts`, preferências locais |
| `src/sync` | Motor de sync (a implementar) |
| `src/i18n` | i18next, pt-BR (padrão) e en; formatação de números/datas |

## Regras checadas pelo lint
- Nenhuma cor literal (hex/rgb) fora de `src/theme/theme.ts`.
- Nenhum `fontWeight` (o peso vem do `fontFamily`).
- Nenhuma sombra difusa (`elevation`, `shadowRadius`, `shadowOpacity`).

Ícones: `src/components/Icon.tsx` é cópia de `docs/1More-icones/1more-icons/Icon.tsx`; ao atualizar o pacote, copie de novo.
