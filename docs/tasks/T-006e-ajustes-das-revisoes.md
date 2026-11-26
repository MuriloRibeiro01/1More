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
