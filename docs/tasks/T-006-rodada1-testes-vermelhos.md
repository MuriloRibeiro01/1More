# T-006e e T-006a (itens 1 a 3) — testes vermelhos da rodada 1 (Dumont → Prisma)

Rode só os arquivos novos: `npx jest __tests__/t006e __tests__/t006a`. Hoje: **46 vermelhos, 8 verdes (controles e guardas)**. `tsc` limpo, ESLint sem erros.
Todo vermelho falha por funcionalidade ausente. Fora de escopo: M1, C18, C19, superset, atividades, tipo de série, arrastar.

## T-006e
| Arquivo | O que cobre | Regra que o vermelho espera |
|---|---|---|
| `t006e/finalizarSemReps.test.ts` | S1 | `finishWorkout(pending:'complete')` e `resolvePending('complete')` só concluem pendentes **com reps > 0**; a sem reps não ganha `completed_at`; o treino finaliza normalmente. Mesma regra do `updateSet` |
| `t006e/expurgo.test.tsx` | S2 / C43 | **Contrato novo:** `src/db/purge.ts` exporta `purgeExpiredTombstones(db, now = Date.now()): Promise<number>` (nº de linhas apagadas). Usa `isPurgeable` (>= 30 dias). Apaga fisicamente (`destroyPermanently`) linhas de `workout`, `workout_exercise`, `workout_set`, `routine`, `routine_exercise`, `routine_set`, `exercise_note` com `deleted_at` vencido, inclusive filhos; 29 d fica; 30 d exatos some; dado vivo (`deleted_at` nulo) e catálogo nunca; idempotente. **`App.tsx` chama na abertura** (junto do `seedCatalog`; falha não impede abrir). O teste monta o `<App />` de verdade com o banco de teste |
| `t006e/semanaFuso.test.ts` | S7 | `weeklyMuscleSets` e `loadSummary.weekDays` cortam a semana pelo `tz_offset_min` de cada treino, não pelo fuso do aparelho. Os casos usam o fuso do aparelho +/- 3 h, então valem em qualquer máquina |
| `t006e/recordeCorporal.test.ts` | S8 | `exerciseRecords`: com carga 0/nula **não existe** `weight` (recorde de carga) nem `oneRm` nem `setVolume`; `reps` continua. Com carga > 0 o recorde de carga é essa série. **Mudei 1 linha** em `fase8/exercicioRecords.test.ts:51` (esperava `weight` com 0 kg; agora `toBeUndefined`) |
| `t006e/exercicioIdioma.test.tsx` | S11 | `ExerciseScreen` formata `longDate`/`shortMonth` com o idioma do app (`i18n.language`), nunca com `undefined`. O teste simula o aparelho no idioma contrário (spy em `Intl.DateTimeFormat`) |
| `t006e/stepperTokens.test.ts` | S12 | Sem `minWidth`/`minHeight` numérico literal em `src/**/*.tsx` (hoje só `Stepper.tsx:71`). Usar token (`size.*`/`space.*`; se faltar, criar em `theme.ts`) |

## T-006a (itens 1 a 3)
| Arquivo | O que cobre | Regra que o vermelho espera |
|---|---|---|
| `t006a/serieDaVez.test.tsx` | C13 | A **primeira série pendente** tem a `Linha` com `destaque` (fundo `stripeWash` do tema); ao concluir passa para a próxima; desmarcar devolve; concluir a 2ª com a 1ª pendente não move; sem pendentes, nenhuma. Papel e Noite. **Em aberto:** com 2+ exercícios, a vez é por exercício ou do treino todo? O teste só usa 1 exercício. O texto "em tinta" na faixa conflita com "valores a lápis" (inkMuted) e não está testado |
| `t006a/trocarExercicio.test.tsx` | C16 | Folha `···` ganha botão **"Trocar exercício"** (ao lado de "Remover exercício"); abre o `ExercisePicker` (seleção única); tocar no exercício troca e volta ao treino (se houver botão de confirmar "Trocar…"/"Confirmar…", o teste o toca). Concluídas ficam no exercício antigo, pendentes vão para o novo (mantendo carga/reps alvo); sem concluídas o antigo some (tombstone) e o novo herda todas; volume (`workoutVolume`) não muda; outro exercício intacto; grava no banco na hora |
| `t006a/verHistorico.test.tsx` | C17 | Folha `···` ganha **"Ver histórico e recordes"**: abre a tela `Exercise` (botões Recordes/Histórico, recorde da sessão antiga). O `Voltar` devolve o treino: caixinha 1 marcada, `82,5` digitado e não salvo, descanso em andamento; banco igual; o `ActiveWorkout` não é desmontado (continua na pilha) |

Observação: os testes de C16/C17 usam `fake timers` (o descanso real é `setInterval`); não os troque por relógio real.
