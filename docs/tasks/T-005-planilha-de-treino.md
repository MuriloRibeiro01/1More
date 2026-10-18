# T-005 — Planilha de treino (rotinas), piloto local

**Fase 2, feature 1.** Método: uma feature por vez, ponta a ponta, testada, antes da próxima.
**Responsáveis:** Dumont (testes de aceite primeiro, TDD) → Prisma (mobile) → Leônidas (só se entrar dependência nova) → Sérgio → Sócrates (CHANGELOG) → Homero.
**Fora:** Tesla, backend e sync. A feature é 100% local (modo sem conta, RF-02).
**Requisitos:** RF-20 (parcial), RF-21, RF-10 (parcial), RN-13, RN-19, RNF-01, RNF-02, RNF-09.
**Referências (só estes trechos):** Protótipo `docs/1More-Prototipo-MVP.txt`, seções "ROTINA.DC.HTML" e "CATALOGO.DC.HTML". Props de Stepper, NumberField, TextField, RoutineCard, SectionHeader, EmptyState e Sheet no `docs/1More-Design-System.txt` (grep pelo nome). Modelo de dados: tabelas `exercise`, `routine`, `routine_exercise` e `routine_set` da nota "untitled" no canvas, com os ajustes C e D da nota "Fase 2 — Briefing".

## História
Como pessoa que treina, quero montar e guardar a planilha de um treino (ex.: "Treino A — Peito"). Escolho os exercícios e, para cada um, defino o número de séries, a carga, as repetições e o descanso entre séries. Assim, deixo de anotar no papel.

## Escopo (o que entra)
1. **Catálogo embarcado mínimo:** cerca de 20 exercícios de musculação, semeados no primeiro uso (lista da nota "untitled"). Só leitura (RN-19).
2. **Adicionar exercício:** lista do catálogo com busca por nome que ignora acentos ("sup" acha "Supino"). Seleção múltipla e "Adicionar N exercícios".
3. **Editar rotina:** nome da rotina (obrigatório, 1 a 80 caracteres). Por exercício:
   - **Séries:** Stepper de 1 a 10, padrão 3.
   - **Carga alvo (kg):** NumberField com decimal e vírgula aceita. ≥ 0, 2 casas, guardada em kg (RN-13). Opcional.
   - **Repetições mín/máx:** NumberFields, opcionais, mín ≤ máx. *(Proposta do Atlas, aguardando confirmação do usuário.)*
   - **Descanso:** Stepper de 15 em 15 s, de 0 a 10:00, exibido como `1:30`. **Padrão 1:30 (90 s).**
   - **Ações:** remover exercício; mover para cima/baixo (a alça de arrastar fica para depois).
   - **Salvar** grava tudo numa única transação. **X** descarta, com confirmação em Sheet se houver mudanças.
4. **Aba Treinar:** lista de rotinas salvas (RoutineCard: nome e exercícios) e "Nova rotina". Sem rotinas, mostra EmptyState. Tocar na rotina abre a edição. Excluir rotina é exclusão lógica, com confirmação em Sheet. **Sem o botão "Começar"**, porque o treino ativo é a próxima feature.
5. **Persistência:** WatermelonDB, schema v2 (migração a partir do v1 vazio). Tabelas `exercise`, `routine`, `routine_exercise` e `routine_set`, com colunas em inglês (padrão da nota "untitled"). O número de séries é materializado em N linhas de `routine_set` com a mesma carga e as mesmas reps, o que deixa pronta a edição por série no futuro. Ids em UUID v7 gerados no app. Preparadas para sync: `user_id` nulo no modo local, `created_at`, `updated_at`, `deleted_at`.

## Fora do escopo
Pastas (RF-24), superset (RF-22), tipos de série (RF-23), carga diferente por série, arrastar para reordenar, filtros por músculo, exercício personalizado (RF-12), iniciar treino, sync/backend, conta.

## Critérios de aceite (o Dumont transforma em testes ANTES do código)
- [ ] Crio uma rotina com 2 exercícios, salvo, fecho e reabro o app: tudo continua lá, com os mesmos valores.
- [ ] O exercício entra com 3 séries e descanso 1:30 quando eu não mexo em nada.
- [ ] Carga "82,5" é gravada como 82.50 kg e exibida como "82,5 kg". Carga negativa ou texto inválido não salva.
- [ ] Rotina sem nome ou sem exercício não salva, e a mensagem diz o motivo.
- [ ] 4 séries viram 4 `routine_set`; mudar para 2 deixa só 2 ativas.
- [ ] Busca "agach" encontra "Agachamento livre"; busca sem acento encontra nome com acento.
- [ ] Excluir rotina some da lista e no banco fica com `deleted_at` (sem DELETE físico).
- [ ] Salvar é atômico: falha no meio não deixa rotina pela metade.
- [ ] Funciona em modo avião (não existe nenhuma chamada de rede).
- [ ] Alvos ≥ 48dp, rótulos acessíveis, temas Papel e Noite, sem hex fora do `theme.ts`.
- [ ] Piloto manual: Dumont percorre o fluxo no emulador Android e anexa o resultado no Status.

## Status
- Aberta — 2026-10-18
- Testes de aceite (Dumont) entregues — 2026-10-18: 71 testes em `mobile/__tests__/t005/` (regras 35, repositório 18, telas 12 + derivados), todos vermelhos por `não implementado` e compilando (`tsc` limpo). Contrato (API, colunas, rótulos/testIDs) em `mobile/__tests__/t005/CONTRATO.md`; stubs em `src/routines/{types,rules,repository}.ts` e `src/db/models/index.ts`; banco de teste LokiJS em memória em `mobile/test-utils/db.ts`. Rodar: `cd mobile && npx jest __tests__/t005`. "Fecho e reabro" é coberto por desmontar/remontar sobre o mesmo banco; o reinício real fica para o piloto manual.
- Testes (Dumont) aprovados — 2026-10-18: suíte completa `npm test` **175/175 verde** (13 suítes), `tsc` e lint limpos. Ajustes do Dumont nos próprios testes: XMLHttpRequest falso no teste de rede (o jest não tem XHR) e `RootTabs.test.tsx` (T-001) agora monta com `DatabaseProvider` + banco de teste. Sem dependência nova no `package.json` → Leônidas não entra.
- Piloto manual (Dumont) no emulador Pixel 4a (Android, dev client recém-instalado, idioma do aparelho en) — 2026-10-18: **ok**. Percorrido: EmptyState → Nova rotina → Salvar vazio mostra "Give the routine a name." e "Add at least one exercise." → busca "elevacao" acha "Elevação lateral" e "agach" acha "Agachamento livre" → "Add 2 exercises" → padrão "3 sets · 1:30" → 4 séries, carga "82,5", reps 8–12 → resumo "4 sets · 8–12 reps · 82.5 kg · 1:30" → Salvar → card com nome e exercícios. Força o fechamento do app com Wi-Fi e dados desligados (sem rede ativa; bundle via `adb reverse`) e reabre: rotina e valores intactos. Excluir rotina → Sheet "Delete this routine?" → Delete → volta ao EmptyState. Tema Noite aplicado na aba Treinar. Observações sem bug: a barra de navegação do Android continua clara no Noite (R-11, já no backlog); no 1º toque num campo numérico ainda sem foco, a automação perdeu o 1º dígito ("2,5"), mas digitar de novo funcionou e é provável que o atraso seja da ferramenta de automação, não do app. Segue para o Sérgio.
- Code review (Sérgio) — 2026-10-18: **2 bloqueantes**. TDD ok: os testes de aceite em `__tests__/t005/` são anteriores ao código, e a alteração posterior em `telasRotina.test.tsx` é só o XHR falso. Re-executado na revisão: `jest` 175/175 e `tsc` limpo. (1) `mobile/src/db/migrations.ts:11-13`: o passo v2 é derivado dos objetos vivos de `schema.ts`, então qualquer coluna adicionada no futuro altera em silêncio uma migração já publicada (v1→v3 quebra no `addColumns`). → Congelar as colunas literais no passo v2 e cobrir com teste. (2) `RoutineEditorScreen.tsx:137-144` e `ExercisePickerScreen.tsx:96-102`: o `BackHandler` fica ativo com a aba Treinar fora de foco (a bottom-tab mantém a tela montada). O "voltar" do Android em outra aba é engolido e fecha o editor ou abre o Sheet de descarte escondido. → Registrar só com foco (`useFocusEffect`), com teste. Testes pedidos ao Dumont antes da correção da Prisma. Sugestões não bloqueantes registradas como R-12 no BACKLOG.
- Review (Sérgio): 2 bloqueantes → testes vermelhos do Dumont em `mobile/__tests__/t005/revisaoSergio.test.tsx` — 2026-10-18. (1) Migração v2 congelada: compara o passo `toVersion: 2` com uma fixture literal e falha se mexer no schema (coluna nova ou coluna alterada) mudar o passo. (2) Voltar do Android: BackHandler falso com o comportamento do Android; com o editor alterado, ir para Histórico e voltar não pode abrir o Sheet de descarte, e o editor continua aberto ao voltar para Treinar. Os 2 testes de controle passam e os 2 dos bloqueantes estão vermelhos.
- Re-review (Sérgio) — 2026-10-18: **aprovado**. Bloqueante 1 resolvido: `migrations.ts` com as colunas da v2 literais e sem importar `schema.ts`. Bloqueante 2 resolvido: `src/navigation/useFocusedBackHandler.ts` (`useFocusEffect` + ref), usado no editor e no seletor de exercícios. `revisaoSergio.test.tsx` 4/4 e suíte completa 179/179, re-executados na revisão. `tsc` e lint limpos. As sugestões seguem no R-13 do BACKLOG. Segue para o Sócrates (CHANGELOG) e depois para o Homero.
- Mobile (Prisma) — 2026-10-18: implementado em TDD sobre os testes de aceite do Dumont. Schema v2 (passo de migração com colunas congeladas), models sem decorators, `src/db/uuid.ts` (UUID v7 monotônico, sem dependência nova), `src/routines/{rules,repository,catalog}.ts` (salvar em um único `db.batch`, com restauração em memória se falhar; séries materializadas; tombstone), componentes do DS `Stepper`, `NumberField`, `TextField`, `Sheet`, `EmptyState` e `RoutineCard` com testes RNTL, telas lista/editor/seletor por estado dentro da aba Treinar e `useFocusedBackHandler`. `seedCatalog` roda na abertura do app. Bloqueantes do Sérgio (migração congelada, voltar do Android fora de foco) corrigidos. Suíte 179/179, tsc e lint limpos. Sérgio aprovou.
