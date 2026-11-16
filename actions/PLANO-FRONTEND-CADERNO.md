# Plano de ação — Frontend no estilo Caderno

**Referência definitiva:** `docs/1More-Prototipo-MVP-caderno.pdf` (texto em `docs/1More-Prototipo-caderno.txt`), de 12 nov 2026. Substitui o protótipo de 14 out (cartões).
**Escopo:** `mobile/` (Prisma). Backend e sync ficam fora (T-002 a T-004 seguem no backlog).
**Estado de partida:** base + T-005 (planilha de rotinas) com visual de cartões; Histórico e Progresso vazios; Perfil só com tema; SDK 58 atualizado em arquivos, ainda não validado em dispositivo.

## Regras deste plano
- **Não buildar neste notebook (8 GB de RAM).** Aqui só edição, typecheck, lint e jest. Build, emulador e teste em aparelho ficam para o desktop (checklist na Fase 0).
- Fluxo do time (CLAUDE.md): Atlas cria a tarefa em `docs/tasks/` → Dumont escreve os testes de aceite → Prisma implementa em TDD → Leônidas (se tocar auth/dados pessoais/deps) → Sérgio → Sócrates → Homero commita.
- **Uma branch por feature** (`feat/T-xxx-slug`), a partir da `main`. Cada fase abaixo vira uma ou mais tarefas; os números T-xxx são sugestão, quem define é o Atlas.
- Regras de negócio e telas seguem o TDD do CLAUDE.md (RN-xx em vermelho→verde→refatorar; componentes com RNTL cobrindo acessibilidade e alvo ≥ 48dp).
- Cores só via `theme.ts`. Fontes e peso via `fontFamily`. Texto pt-BR em `i18n`. Nada de gradiente, sombra, pílula, emoji, raio > 4px.

---

## Fase 0 — Preparação e documentação
**Dono:** Atlas, Sócrates, Homero. **Sem código de produto.**
- [ ] Renomear `docs/1More-Prototipo-caderno.txt` → `1More-Prototipo-MVP-caderno.txt` (casar com o PDF).
- [ ] Atualizar referências ao protótipo antigo (`1More-Prototipo-MVP.*`) no `CLAUDE.md`, `README.md`, `docs/guias/*` e tarefas.
- [ ] Registrar no `CLAUDE.md` e nos docs de design que o **Design System e o Guia RN estão defasados** quanto ao visual (ainda mostram cartões) e que o caderno prevalece.
- [ ] Homero: commitar a troca de protótipo e a atualização do SDK 58 (`mobile/package.json`, `app.json`, lockfile) em branch própria.
- [ ] Atlas: criar as tarefas das fases 1–9 em `docs/tasks/` e atualizar o `BACKLOG.md`.
- [ ] **No desktop (mais RAM):** `cd mobile && npx expo start -c`; `npx expo run:android` (e iOS se houver Mac); confirmar que o plugin do WatermelonDB funciona no SDK 58 e rodar `npm test`. Anotar o resultado em `docs/guias/CHANGELOG.md` (relaciona R-10e e R-12).

**Pronto quando:** docs coerentes com o caderno, SDK 58 validado no desktop, tarefas criadas.

## Fase 1 — Fundação visual do caderno ✅ concluída (2026-11-12)
**Dono:** Prisma (testes: Dumont). **Tarefa sugerida:** T-006.
Primitivas novas em `mobile/src/components/` (mesmos nomes do Design System quando existirem):
- [x] `Folha`: container da tela com fundo papel e a **linha de margem vermelha fixa a 44px** (View absoluta de 2px).
- [x] `Linha`: item com sublinhado de 1px na cor `rule` de borda a borda; alturas 28px (texto) e 56px (tocável); coluna de margem de 44px.
- [x] `Titulo`: Racing Sans One, caixa alta, com sublinhado `hugger` de 3px; variante de nome de exercício com régua de tinta de 2px.
- [x] `LinkCaneta`: ação secundária sublinhada (substitui `Button` secundário).
- [x] `Caixinha` (check azul `grabber`), `CarimboPR` (laranja), `FaixaDestaque` (`stripeWash`), `LivroCaixa` ("Volume ........ 12.340 kg").
- [x] Revisar `Button` (um botão cheio por tela), `TopBar` (com voltar), `TabBar`, `Sheet`, `Stepper`, `NumberField`, `TextField` para o estilo sem caixas/contornos.
- [x] Teste de componente para cada primitiva: papel nos dois temas (Papel/Noite), `accessibilityState`, alvo ≥ 48dp.

**Pronto quando:** primitivas testadas, nenhum componente novo usa cartão, sombra ou contorno.

**Entregue:** `Folha`, `Linha` (com `destaque`), `Titulo`, `LinkCaneta`, `Caixinha`, `CarimboPR`, `LivroCaixa`; `Button`, `TopBar` e `TabBar` revisados; testes em `mobile/__tests__/caderno.test.tsx`. `FaixaDestaque` virou a prop `destaque` da `Linha`. Falta conferir o visual no desktop e o Homero criar a branch/commit.

## Fase 2 — Migrar o que já existe (T-005) para o caderno 🟡 visual e R-13 feitos; faltam itens que dependem de dados
**Dono:** Prisma. **Tarefa sugerida:** T-007.
- [x] `RoutineListScreen`: linhas com a letra da rotina (A, B…) na margem; remover `RoutineCard`.
- [ ] `RoutineEditorScreen`: letra na margem, nome grande, exercício em linha que abre os ajustes logo abaixo; séries e descanso com −/+; superset (margem vira 3a/3b); remover; `≡` para reordenar (visual no protótipo; implementar de fato se couber); salvar / X.
- [x] `ExercisePickerScreen` vira lista de verificação com a caixinha na margem; busca sem acento; filtros escritos (sublinhado no ativo); **"Adicionar N exercícios"**; **"+ Criar exercício próprio"** (RF-12); exercício do catálogo só se oculta (RN-19).
- [x] Manter os testes existentes verdes; ajustar os que dependem de `RoutineCard`.
- [x] Atenção ao **R-13**: o rascunho deve carregar o `routineExerciseId` (reaproveitar por id, não por posição) — fazer aqui, antes de existir treino.

**Pronto quando:** as 3 telas da T-005 no estilo caderno, suíte verde.

**Entregue:** lista de rotinas em linhas com letra na margem (`RoutineCard` removido); catálogo como lista de verificação com `Caixinha` e destaque; editor com `Folha`/`Linha`; `EmptyState` com `Titulo`; R-13 (`routineExerciseId` carregado e reaproveitado por id) com testes em `__tests__/t005/identidadeRotina.test.ts`.
**Pendente (precisa de decisão ou de dados novos, não é só visual):** `RoutineEditorScreen` ainda sem letra da rotina, superset (3a/3b) e `≡` de arrastar; filtros por músculo e "+ Criar exercício próprio" (RF-12) pedem campo de músculo no catálogo e criação de exercício no repositório — levar ao Atlas.

## Fase 3 — Navegação em pilha sobre as abas ✅ concluída (2026-11-12), com 1 item adiado
**Dono:** Prisma. **Tarefa sugerida:** T-008.
- [x] Pilha (stack) acima das 4 abas: **abas só nas 4 telas principais**; treino, catálogo, resumo, edição e telas de detalhe têm `TopBar` com voltar.
- [x] Trocar a navegação por estado do `TrainScreen` pelas rotas reais; manter a ordem das abas (RNF-08) e o botão voltar do Android (`useFocusedBackHandler`).
- [ ] Espaço reservado para a faixa **"Retomar"** visível em qualquer aba (preenchido na Fase 5).
- [x] Testes: navegação entre telas, voltar, abas ocultas nas telas de fluxo.

**Entregue:** `navigation/RootNavigator.tsx` (native-stack com `Tabs` + `RoutineEditor`), `TrainScreen` navega pela pilha, a lista recarrega ao ganhar foco, testes em `__tests__/navegacao.test.tsx`. Dependência nova: `@react-navigation/native-stack` (**Leônidas deve revisar**).
**Adiado:** (1) espaço da faixa "Retomar" — entra na Fase 5 dentro do `AppTabBar`, junto com o treino ativo (hoje não há dado para mostrar); (2) o catálogo continua dentro do editor, por estado: vira rota na Fase 5, quando o treino ativo também o usar (aí o resultado volta por parâmetro de rota).

## Fase 4 — Dados de treino e regras de negócio (TDD) ✅ concluída (2026-11-12), com pendências no desktop
**Dono:** Dumont (testes de aceite) → Prisma. **Tarefa sugerida:** T-009. **Núcleo do app; Sérgio bloqueia sem teste antes.**
- [x] Schema + migração WatermelonDB: `workout`, `workout_exercise`, `workout_set` (UUID v7, `user_id`, `created_at`, `updated_at`, `server_version`, `deleted_at`; carga em kg com 2 casas; UTC + fuso). Alinhar com o modelo de `docs/requisitos.txt`.
- [x] Regras puras com teste primeiro (vermelho→verde→refatorar):
  - rotina do dia = a há mais tempo sem ser feita (RN-02);
  - duração = início até a última série concluída (RN-03);
  - treino parado > 4 h → "Esqueceu de finalizar?" e finalizar no horário da última série (RN-04);
  - nenhuma série feita → descartar (RN-05); pendentes → marcar, descartar ou voltar (RN-06);
  - 1RM Epley só para 1–12 reps (RN-10); volume; PR só em séries válidas, não aquecimento (RN-08/RN-11); recálculo ao editar sem duplicar XP (RN-16);
  - conversão kg/lb (RN-13), semana começando na segunda (RN-24), exclusão lógica por 30 dias (RN-20).
- [x] Gravar a série em **transação antes de mudar a UI** (RNF-02), < 100 ms; teste de "kill durante escrita" fica para o desktop.
- [x] Repositório de treino (criar, retomar após crash, concluir série, finalizar, repetir).

**Entregue:** schema/migração v3 (`workout`, `workout_exercise`, `workout_set`, com colunas de sync), models, `src/db/rows.ts` (helpers compartilhados), `src/workout/{types,rules,week,repository}.ts`. Testes: `__tests__/fase4/` (regras puras, repositório com banco em memória, migração v3). 67 testes novos.
**Decisões:** carga nula conta como 0 kg (peso corporal); empate não é PR; sem histórico válido não há PR; XP é função pura dos dados (`dayXp`, `grantsXp`), então editar o treino não duplica (RN-16). O treino livre usa `name: ''` (a tela traduz). RN-02: um segundo `startWorkout` lança `ActiveWorkoutError` com o id do ativo.
**Pendente no desktop:** teste de "kill durante escrita" (RNF-02) em aparelho, e rodar a migração v2→v3 num banco SQLite real (os testes usam LokiJS em memória). Sérgio deve rever o repositório; não há dependência nova nesta fase.

## Fase 5 — Treinar (início) e Treino ativo ✅ concluída (2026-11-12), com itens adiados
**Dono:** Prisma. **Tarefas sugeridas:** T-010 (início) e T-011 (treino ativo).
**Início (aba Treinar):**
- [x] Rotina do dia em destaque com o único botão cheio "Começar treino"; linhas das demais rotinas (1 toque → treino); "+ Nova", "Editar rotinas", "Treino livre".
- [x] Semana com dias treinados circulados e hoje sublinhado em laranja; some com a gamificação desligada (RF-64).
- [x] Faixa amarela **"Retomar"** (inclusive após crash); vira "Esqueceu de finalizar?" após 4 h.

**Treino ativo (tela sem abas):**
- [x] Nome do exercício grifado; série por linha; margem com número ou A/D/F; valores anteriores a lápis (`inkMuted`) usados ao tocar a caixinha; série da vez em `FaixaDestaque`.
- [x] Caixinha conclui com 1 toque (grava, inicia descanso); toque no número edita inline (teclado decimal/numérico); "+ série" copia a última.
- [x] `···` do exercício em `Sheet`: trocar exercício, ver histórico e recordes, remover.
- [x] Descanso fixo no rodapé (+15s, Pular); timer por **horário de término** + notificação local; ao zerar fica laranja e vibra. Tela sempre ligada (dependências novas → Leônidas: `expo-keep-awake`, `expo-notifications`, `expo-haptics`).
- [x] Carimbo PR no momento da conclusão. Finalizar com as `Sheet` RN-05/RN-06. Seta para baixo minimiza → Treinar.
- [x] Reaproveitar o seletor de exercícios (Fase 2) em "+ Adicionar exercício".
- [x] Meta: do app fechado à 1ª série em **2 toques**.

**Entregue (TDD, teste visto falhar antes):** início da aba Treinar (rotina do dia com o único botão cheio, linhas com letra, semana, "Treino livre", "Editar rotinas"), `FaixaRetomar` em qualquer aba (vira "Esqueceu de finalizar?" após 4 h), `ActiveWorkoutScreen` (série por linha com valores a lápis, caixinha de 1 toque gravando antes de confirmar, edição inline, + série, PR no ato, descanso por horário de término com +15 s/Pular/vibração, folhas RN-05/RN-06/RN-04, minimizar), catálogo como rota (`ExercisePicker`) e `restTimer`/`queries`/`useActiveWorkout`. 98 testes novos (338 no total).
**Adiado / não feito:**
- **Dependências nativas:** notificação local do descanso (`expo-notifications`) e tela sempre ligada (`expo-keep-awake`). Dependências novas: Leônidas revisa e o dev client precisa de rebuild (desktop).
- **Opções do exercício:** "Trocar exercício" e "Ver histórico e recordes" (este depende da tela Exercício, Fase 8). Hoje o `···` só tem "Remover".
- **Seletor de tipo de série** (toque na margem): o protótipo não tem tela; a margem só exibe A/D/F.
- **Rotina do dia na hora:** `forgotten` só reavalia quando o banco muda (comentário `shortcut:` no hook).
- **Fim do treino:** ao finalizar volta para a aba; o resumo é a Fase 6. O círculo "à caneta" dos dias virou caixa de 2 px (raio máx. 4 px do DS).

## Fase 6 — Treino finalizado (resumo) ✅ concluída (2026-11-12)
**Dono:** Prisma. **Tarefa sugerida:** T-012.
- [x] Resumo em formato livro-caixa (duração, volume, séries), recordes com carimbo PR na margem, nota opcional em linhas pautadas salva com o treino.
- [x] Linha "Semana" some com gamificação desligada; "salvo no aparelho" quando offline; "Fechar" → Treinar.

**Entregue (TDD):** `src/workout/summary.ts` (`buildSummary`, `formatDuration`, `loadSummary`, `saveNotes`), `WorkoutSummaryScreen` (livro-caixa: duração, volume, séries, semana; recordes com `CarimboPR` e tipo; nota opcional salva ao sair do campo; "Salvo no aparelho"; Fechar), rota `WorkoutSummary` que **substitui** o treino ativo na pilha. `validSetHistory` ganhou o filtro `beforeStartedAt` (um treino antigo só compara com os anteriores) e `WorkoutSnapshot` ganhou `notes`. 24 testes novos (362 no total).
**Decisões:** um recorde por exercício (a última série que bateu algum, com os tipos acumulados); a linha "Semana" mostra dias treinados e some quando existir a opção de gamificação desligada (Perfil, Fase 9, RF-64); o resumo não tem seta de voltar (só Fechar), então voltar do sistema leva às abas.
**Atenção:** o teste "steppers respeitam os limites" (T-005) estoura o timeout de 5 s quando a máquina está carregada (passa isolado); considerar aumentar o timeout dele.

## Fase 7 — Histórico ✅ concluída (2026-11-12), exceto atividades não-musculação
**Dono:** Prisma. **Tarefa sugerida:** T-013.
- [x] Lista por semana com a data na margem ⇄ visão de mês com dias circulados; toque no dia abre o treino passado.
- [x] Treino passado: linhas `82,5×10 · 82,5×9 · 80×9` (D = drop); Editar/Pronto (recalcula PR e volume); "Repetir este treino" (3 toques desde o Histórico); Excluir com `Sheet` (tombstone 30 dias).
- [x] "+ Registrar treino passado" (retroativo). Atividades não-musculação na mesma lista.

**Entregue (TDD):** aba Histórico (Lista por semana com a data na margem ⇄ Mês, retroativo por `Sheet` com Dia/Hora/Minuto, RN-07 bloqueia futuro e só avisa sobreposição); treino passado (`WorkoutDetailScreen`: linhas de diário `82,5×10 · 82,5×9 · D 80×9`, duração/volume, carimbo PR, Editar/Pronto com recálculo de volume e PR, Repetir este treino, Excluir com Sheet e tombstone, treino recém-registrado vazio é descartado ao sair); repositório: `createRetroactiveWorkout`, `removeSet`, `syncWorkoutEnd`, `hasOverlap`. 50 testes novos (412 no total). O teste lento dos steppers ganhou timeout de 30 s.
**Não feito:** atividades não-musculação (corrida, luta) na mesma lista — o modelo `workout_set` só tem carga×reps; precisa de decisão do Atlas e de colunas (duração/distância) numa migração v4.
**Atenção:** o teste de data futura do retroativo usa 23:55 de hoje, então falha se rodar depois desse horário; vale congelar o relógio dele. Mês anterior na virada de ano não foi testado.

## Fase 8 — Progresso e Exercício ✅ concluída (2026-11-12), "Como fazer" sem conteúdo
**Dono:** Prisma. **Tarefa sugerida:** T-014.
- [x] Gráfico desenhado direto na folha, sem moldura nem grade, recorde em laranja (`react-native-svg`, já instalado); trocar exercício e métrica (1RM, melhor série, volume).
- [x] Séries por músculo na semana em uma linha de texto (RF-45); peso corporal **não** fica aqui (vai para o Perfil).
- [x] Tela Exercício com seções Recordes · Histórico · Como fazer, nota fixa do exercício, sugestão de carga por progressão dupla (só sugestão, RN-12). "Como fazer" depende de conteúdo/cache de demonstração — confirmar escopo com o Atlas.

**Entregue (TDD):** `src/workout/sessions.ts`; Progresso: `src/progress/series.ts` (1RM/melhor série/volume, recorde = supera todos os anteriores), `weeklyMuscles.ts`, `GraficoCaderno` (SVG, sem moldura nem grade, recorde em laranja), `ProgressScreen` (exercício e métrica por `Alternar`, linha de recorde → Exercício, séries por músculo na semana, aviso sem 1RM por RN-10); Exercício: `src/exercise/{records,suggestion,data}.ts`, `ExerciseScreen` (Recordes · Histórico · Como fazer, sugestão RN-12 só como sugestão, nota fixa), **schema/migração v4** (`exercise_note`, o catálogo continua read-only, RN-19). 87 testes novos (490 no total).
**Decisões:** recorde de empate vale o mais antigo; sugestão olha a última sessão (sobe se todas chegaram ao topo; reduz 10% se as 2 últimas ficaram abaixo do mínimo) e só usa a faixa da rotina mais recente; "Peso corporal" saiu do Progresso (vai para o Perfil).
**Pendente:** conteúdo de "Como fazer" (demonstração com cache, RF-14) — a tela mostra "ainda não disponível" e depende de decisão de conteúdo (ADR-001); rodar a migração v3→v4 em SQLite real no desktop; extrair o helper do diário `82,5×10` (duplicado em `ExerciseScreen` e `WorkoutDetailScreen`); o Exercício ainda não é aberto de dentro do treino ativo (`···` → "Ver histórico e recordes").

## Fase 9 — Perfil e Onboarding
**Dono:** Prisma (Leônidas revisa dados de saúde/consentimento). **Tarefas sugeridas:** T-015 (Perfil) e T-016 (Onboarding).
**Perfil:**
- [ ] Ajustes como linhas escritas, valor à direita, sem interruptores: Unidade (kg/lb), incremento, descanso, meta semanal, anilhas, Tema (Papel/Noite/sistema, já existe), Sequência e XP, lembrete, tela ligada.
- [ ] Ajustes com várias opções abrem `Sheet` de escolha. Peso corporal (opt-in, RN-25), exportar (grátis, RN-22), importar, entrar para ter backup e excluir conta: **só a linha/entrada**; fluxos reais dependem de T-002/T-003.

**Onboarding (primeira abertura):**
- [ ] Capa com um único botão; "Já tenho conta" (login real só com T-002, antes disso fica desativado ou pula).
- [ ] 4 passos: Objetivo (escolha única) → Dias por semana (1–7, RN-14) → Unidade e nível → Como começar (divisão ABC pronta / montar minha rotina / treino livre). Não pedir peso, altura nem nascimento.
- [ ] Persistir no SQLite local, funcionando sem conta.

## Fase 10 — Acabamento e QA
**Dono:** Dumont, Sérgio, Sócrates.
- [ ] Revisar os dois temas (Papel/Noite) em todas as telas; alvos ≥ 48dp; acessibilidade; tudo do treino alcançável com uma mão (RNF-09).
- [ ] Verificar **modo avião** em todo o fluxo (RNF-01, RN-01) e a contagem de toques da tabela do protótipo.
- [ ] Testes E2E dos fluxos principais (no desktop).
- [ ] Sócrates: atualizar `docs/guias/mobile.md`, `README.md`, glossário e `CHANGELOG.md`.

---

## Fora do protótipo (definir com o Atlas antes de implementar)
- Seletor de tipo de série (toque na margem: aquecimento/drop/falha) e calculadora de anilhas: sem tela própria no protótipo.
- Login (Google/Apple/e-mail), importar, exportar, peso corporal e excluir conta: sem fluxo no protótipo; dependem de backend (T-002/T-003).
- Reordenar rotina por arrastar é só visual no protótipo.

## Riscos
- **R-12 / SDK 58:** WatermelonDB "untested on New Architecture" e plugin Expo de terceiros; validar no desktop (Fase 0) antes de apostar nas fases 4+.
- **Design System defasado:** os componentes documentados ainda mostram cartões; a fonte de verdade visual passa a ser o caderno (`caderno.css` do canvas, não está no repo). Pedir o arquivo ao design se faltar detalhe de medida.
- **Dependências nativas novas** (keep-awake, notifications, haptics) exigem novo dev client e revisão do Leônidas.
- **Ordem:** as fases 1→4 são pré-requisito das demais; 6, 7, 8 e 9 podem andar em paralelo depois da 5.
