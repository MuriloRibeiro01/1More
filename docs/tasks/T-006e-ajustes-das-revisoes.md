# T-006e — Ajustes vindos das revisões da T-006

**Continuação da T-006.** Reúne as sugestões do Sérgio (S1, S2, S7, S8, S11, S12) e o achado M1 do Leônidas. As demais (S3 a S6, S9, S10) ficam no backlog ou na T-003.
**Responsáveis:** Dumont (testes vermelhos primeiro) → Prisma → Leônidas (M1) → Sérgio → Sócrates → Homero.
**Fora:** backend e sync.
**Requisitos:** RF-31, RF-45, RN-20, RN-24, RNF-02, RF-72.

## História
Como time, queremos corrigir os desvios pequenos que as revisões encontraram antes que virem dívida.

## Escopo
1. **S1:** `finishWorkout(pending:'complete')` conclui série sem reps, o que `updateSet` proíbe (`workout/repository.ts`). As duas regras devem concordar.
2. **S2 e C43 (RN-20):** `isPurgeable` existe mas nada a chama; criar a rotina de expurgo dos tombstones com mais de 30 dias, chamada na abertura do app, e ligar ou remover as demais regras sem chamador (XP, kg/lb) conforme a decisão do Atlas.
3. **S7:** `weeklyMuscleSets` e `loadSummary` cortam a semana pelo fuso do aparelho; usar `tz_offset_min` do treino (RN-24).
4. **S8:** recorde de carga com 0 kg em exercício de peso corporal não deve valer PR.
5. **S11 (provável causa do C41):** `ExerciseScreen` formata datas com o idioma do aparelho; usar o idioma do app, como as outras telas.
6. **S12:** `Stepper.tsx` com `minWidth: 72` literal fora dos tokens.
7. **M1 (Leônidas):** `npm audit fix` apenas para o `zod`; reavaliar as 2 moderadas de produção (`@babel/runtime` via WatermelonDB, `minimatch`) a cada atualização.

## Critérios de aceite (o Dumont transforma em testes ANTES do código)
- [ ] Finalizar com pendentes marcados como concluídos não cria série sem reps.
- [ ] Um tombstone com 31 dias é expurgado na abertura; com 29 dias permanece; o expurgo não toca em dado vivo.
- [ ] A semana de um treino feito em outro fuso cai na semana correta.
- [ ] Barra fixa com 0 kg não gera PR de carga.
- [ ] Datas da tela Exercício seguem o idioma do app, também com o aparelho em inglês.
- [ ] `npm audit` sem achado alto; suíte verde; `tsc` e ESLint limpos.

## Fora desta tarefa, mas registrado
- **B3 (Leônidas):** o manifesto declara `INTERNET` e `SYSTEM_ALERT_WINDOW` por causa do dev client; remover no build de release (tarefa D1 do plano do MVP).
- **S9:** unicidade de `exercise_note` por exercício: decidir na T-003.
- **S3, S4, S5, S6, S10:** N+1 em `trainedExercises`, 2º registro do mesmo exercício em `lastSessionSets`, rollback repetido em `saveRoutine`, UUID v7 com `Math.random` (R-13b), histórico sem paginação.

## Status
- Aberta — 2026-11-26. Sem decisão pendente; pode começar pelos testes do Dumont.
- Itens 1 a 6 implementados (Prisma, 2026-11-26), testes da rodada 1 verdes (`__tests__/t006e`). Item 7 (M1) segue com o Leônidas. Arquivos: `workout/rules.ts`, `workout/repository.ts`, `db/purge.ts` (novo) + `App.tsx`, `workout/week.ts`, `workout/summary.ts`, `progress/weeklyMuscles.ts`, `exercise/records.ts`, `screens/ExerciseScreen.tsx`, `components/Stepper.tsx`. Pendência de teste: `fase5/treinoAtivo.test.tsx:276` (com o Dumont).
- Code review (Sérgio) T-006e — 2026-11-26, itens 1 a 6, sobre o working tree. t006e + fase4 + fase5/treinoAtivo: 126/126 verdes (rodados por mim). **2 BLOQUEANTES:**
  - **B1 (expurgo, RN-20/RN-21):** `db/purge.ts` apaga fisicamente (`prepareDestroyPermanently`) todo tombstone com ≥ 30 dias sem nenhuma noção de "já sincronizado" e sem comentário sobre a T-003. Com o sync futuro, um aparelho que ficou 30+ dias offline perde o tombstone antes de propagá-lo e a linha "ressuscita" no pull. Exigido: (i) guarda explícita, mesmo que provisória: expurgar só `deleted_at` com `server_version` não nulo (confirmado pelo servidor) OU, enquanto não houver sync, comentário `T-003` no topo do arquivo e no `App.tsx` dizendo que a regra muda (retenção no servidor ou só após confirmação), mais um teste que fixe a decisão; (ii) tirar o expurgo do caminho crítico: em `App.tsx:57-59` ele entra no `Promise.all` que segura a abertura (preferência de tema); deve rodar depois da 1ª tela (ex.: `InteractionManager.runAfterInteractions` ou após `setPreference`), nunca no `Promise.all`. Transação ok (`db.write` + um `db.batch`); cascata pai→filho ok; catálogo, preferências e dado vivo não são tocados.
  - **B2 (S1, RN-03):** em `workout/repository.ts:403-405` as pendentes sem reps ficam em `kept` com `completed_at` nulo e o cálculo as trata como `now`; `ended_at` vira o instante de finalizar mesmo que a última série concluída seja bem anterior (ex.: série 1 às T0+5, série 3 sem reps, finalizar em T0+30 → `ended_at` = T0+30, deveria ser T0+5). O teste `finalizarSemReps` não pega porque a pendente com reps é concluída em T0+30 e mascara. Exigido: `completed` só com séries realmente concluídas (incluindo as que acabaram de ser concluídas) + teste vermelho antes (Dumont). Sugestão junto: tombstonar a pendente sem reps ao finalizar, em vez de deixá-la viva num treino finalizado.
  - (b) `treinoAtivo.test.tsx:276` e `repositorioTreino.test.ts:186`: o ajuste é do teste, não regressão; a asserção antiga ("toda série concluída") contradiz o S1 e a nova é coerente com `updateSet`. `rules.resolvePending` e o repositório concordam.
  - (c) S7 aprovado: `inWeek`/`weekDayKeys`/`weekStartOfDayKey` cortam pelo `tz_offset_min` gravado, a semana continua segunda a domingo e a janela UTC larga (±1 dia) cobre fusos de −12 a +14 nas duas pontas; 9 testes em `semanaFuso`.
  - S8, S11 e S12: aprovados, com teste. Sugestões: (s1) `minWidth: size.sizeTouch * 1.5` deriva de um token de toque só para dar 72; criar token próprio (ex.: `sizeStepperValue`); (s2) `App.tsx:1` põe o import de `./db/purge` antes de `import './i18n'`, quebrando a ordem de efeitos colaterais que o arquivo mantinha; mover para depois; (s3) `purge.ts` usa `db.batch(...registros)` com spread: com milhares de linhas pode estourar a pilha; passar o array.
- M1 (Leônidas) — 2026-11-26: zod vulnerável (GHSA-mrhx-c7xc-m3w5, alta, só dev) vinha de `eslint-config-expo` > `eslint-plugin-react-hooks@7.1.1` (+ `zod-validation-error`). Combinado com o Prisma; rodado `npm update zod --ignore-scripts` em `mobile/`. Delta: só `package-lock.json` (3 linhas: zod 3.25.76 → 4.6.7, resolved, integrity); `package.json` intacto. `npm audit`: 30 (1 alta + 29 moderadas) → 29 moderadas, 0 alta. `npm run lint`: 0 erros (2 warnings pré-existentes em `src/db/purge.ts:37-38`, `no-unused-expressions`). Sem commit (Homero). Moderadas restantes: `@babel/runtime`/WatermelonDB e `minimatch`/`@expo/fingerprint`, ambas exigem `--force` com downgrade; não aplicar.
- B1/B2 do Sérgio e s1-s3 aplicados (Prisma, 2026-11-26): expurgo após a 1ª tela (`App.tsx`, `setTimeout` 300 ms) com a nota T-003 em `db/purge.ts` e `App.tsx`; `finishWorkout` com `ended_at` só de séries realmente concluídas e tombstone da pendente sem reps; token do Stepper em `theme/layout.ts` (o `theme.ts` é cópia do Guia e tem teste de identidade); `batch` sem spread; import de `purge` após `./i18n`. Aguardando os vermelhos de B1/B2 do Dumont.
- Re-revisão T-006e (Sérgio) — 2026-11-26: **aprovado, B1 e B2 resolvidos.** t006e + t006a: 68/68 (rodados por mim). B1: nota `T-003` em `db/purge.ts:4-5` e `App.tsx` (RN-21: só expurgar após confirmação do servidor), expurgo fora do `Promise.all`, em `useEffect` depois da preferência com `setTimeout` de 300 ms, falha só em log, teste `aberturaSemBloqueio`; a regra continua sem guarda por `server_version` (não há sync ainda), então **a T-003 não pode abrir sem tratar isso**: criar item no BACKLOG como pré-requisito da T-003 (Atlas). B2: `ended_at` agora vem só de séries realmente concluídas (`repository.ts` ~447) e a pendente sem reps vira tombstone, com exercício vazio tombstonado; coberto por `finalizarFimDoTreino`. s2 e s3 aplicados (import depois de `./i18n`). s1: **`theme/layout.ts` com `sizeExtra` é aceitável** (theme.ts fica fiel ao Guia, o token sai por `../theme`); sugestão: registrar em `docs/guias` que tokens próprios vão em `layout.ts`, para não voltar a virar literal (o teste `stepperTokens` já barra `minWidth` numérico).
