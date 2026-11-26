# 1More — app mobile

Expo (SDK 58, dev client) + React Native 0.88 + TypeScript + WatermelonDB. Offline-first: a UI lê e grava só
no banco local; o sync roda em segundo plano (`src/sync`, tarefa própria, ainda não implementado).

O app **não roda no Expo Go**: WatermelonDB é módulo nativo, então precisa do dev client.

## Buildar e rodar do zero (Android)

Pré-requisitos: Node e npm, JDK compatível com o Gradle 9, Android SDK e um emulador ou aparelho.
No SDK Android, instale o **CMake 3.31.6** (ver [Requisitos do build](#requisitos-do-build-android)).

```bash
cd mobile
npm install
npx expo prebuild            # gera mobile/android (e aplica os plugins do app.json)
npx expo run:android         # compila, instala o dev client e abre o Metro
npx expo start               # nas próximas vezes: só o Metro, com o dev client já instalado
```

`npm run android` é atalho para `expo run:android`; `npm start` para `expo start`.
Só repita `prebuild`/`run:android` ao mudar dependência nativa, `app.json` ou plugin.

Qualidade: `npm run typecheck && npm run lint && npm test`.

### Requisitos do build Android

| Item | Valor | Por quê |
|------|-------|---------|
| Gradle | 9.4.1 | Definido no wrapper gerado (`android/gradle/wrapper/gradle-wrapper.properties`) |
| Android Gradle Plugin | 9.2.1 | Vem do React Native 0.88 (`@react-native/gradle-plugin`). O AGP 9 não gera `BuildConfig` em bibliotecas por padrão |
| CMake | **3.31.6**, instalado no SDK | O 3.22.1 usa um Ninja que estoura o limite de 260 caracteres de caminho no Windows ("Filename longer than 260 characters"), mesmo com `LongPathsEnabled` ligado. O CMake 3.22.1 traz o Ninja 1.10; o 3.31.6 traz o Ninja 1.12.1 |
| Plugin local | `plugins/withWatermelonBuildConfig.js` | Ver abaixo |

O plugin `plugins/withWatermelonBuildConfig.js` (registrado no `app.json`) faz duas correções que precisam
sobreviver ao `prebuild`, porque `android/` é regenerado:

1. liga `buildFeatures.buildConfig` só para o módulo `nozbe_watermelondb`, que usa `BuildConfig.DEBUG` no Java;
2. fixa `externalNativeBuild.cmake.version = "3.31.6"` no `android/app/build.gradle`.

Se o CMake 3.31.6 não estiver disponível no gerenciador do SDK, instale sem o `sdkmanager`: baixe o zip
`cmake-3.31.6-windows.zip` (URL listada em `repository2-3.xml`, em `dl.google.com`), confira o SHA-1 publicado
nesse XML e extraia em `<SDK>/cmake/3.31.6`. Sem essa pasta o build falha ao procurar a versão.

### `mobile/android` é gerado e não é versionado

`android/` e `ios/` estão no `.gitignore` e são produto do `expo prebuild`. Não edite à mão (a alteração se
perde); mudanças de build entram por plugin em `plugins/`. **Nunca rode `npx expo prebuild --clean` sem
avisar o time**: ele apaga `android/` inteiro, inclusive o que estiver só local (chaves, ajustes de teste).

## Estrutura

| Pasta | O que tem |
|-------|-----------|
| `src/theme` | `theme.ts` copiado do Guia RN (não edite à mão), `ThemeProvider` (Papel/Noite/sistema), `text`, `useOneMoreFonts` |
| `src/components` | Componentes do Design System (mesmos nomes e props; `onClick` do web → `onPress`) e do caderno |
| `src/navigation` | Abas fixas Treinar · Histórico · Progresso · Perfil (RNF-08) com `TabBar` próprio, e a pilha por cima delas |
| `src/screens` | Telas |
| `src/workout`, `src/routines`, `src/exercise`, `src/progress` | Regras e persistência de treino, rotinas, exercício e progresso |
| `src/db` | WatermelonDB: `schema.ts` (versão 4), `migrations.ts`, modelos, preferências locais |
| `src/sync` | Motor de sync (a implementar) |
| `src/i18n` | i18next, pt-BR (padrão) e en; formatação de números/datas |
| `plugins` | Config plugins do Expo (ver acima) |

Detalhes em [`docs/guias/mobile.md`](../docs/guias/mobile.md).

## Regras checadas pelo lint
- Nenhuma cor literal (hex/rgb) fora de `src/theme/theme.ts`.
- Nenhum `fontWeight` (o peso vem do `fontFamily`).
- Nenhuma sombra difusa (`elevation`, `shadowRadius`, `shadowOpacity`).

Ícones: `src/components/Icon.tsx` é cópia de `docs/1More-icones/1more-icons/Icon.tsx`; ao atualizar o pacote, copie de novo.
