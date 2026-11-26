# T-006 — Matriz critério → teste (Dumont)

Referência: `docs/tasks/T-006-frontend-caderno.md` (C01..C46). Pastas relativas a `mobile/__tests__/`.
Legenda: **ok** = coberto · **parcial** = coberto em parte (diz o que falta) · **sem teste** · **lacuna** = o teste mostrou que a funcionalidade não existe.
Os testes novos desta etapa estão em `fase9/aceiteT006.test.tsx` (C04, C11, C12, C13, C42, C43).

| C | Estado | Onde está coberto |
|---|--------|-------------------|
| C01 | ok | `caderno.test` (Folha, Linha, Titulo, Button sem caixa), `regrasDesignSystem.test` (sem cor literal/sombra/gradiente/raio >4) |
| C02 | ok | `RootTabs.test`, `navegacao.test` (ordem fixa; fluxo sem abas), `components.test` (TabBar) |
| C03 | ok | `fase5/retomarNasAbas`, `fase5/faixaRetomar`, `fase5/useActiveWorkout` ("já ativo ao montar"). Reabrir o app é simulado; force-stop real só no aparelho |
| C04 | ok (reforçado) | já: `faixaRetomar`, `retomarNasAbas`, `treinoAtivo` ("parado há mais de 4 h"), `regrasTreino` (RN-04). Novo: `fase9/aceiteT006` C04 — limite 4 h na regra, ±1 min na faixa e na tela do treino, contagem a partir da última série, relógio fixado |
| C05 | ok | `fase5/inicioTreinar` (rotina do dia, empate), `fase4/regrasTreino` ("rotina do dia"), `fase5/queries` |
| C06 | ok | `fase5/semanaCaderno`, `fase5/inicioTreinar` ("semana") |
| C07 | ok | `fase5/inicioTreinar` ("1 toque na linha de outra rotina inicia o treino dela"). Já existia; não escrevi outro |
| C08 | ok | `fase5/treinoAtivo` (registrar séries, descanso), `fase4/repositorioTreino`, `fase5/pesoCorrida` |
| C09 | parcial | `fase4/repositorioTreino` (cada toque já no banco), `useActiveWorkout` (reabre com treino). **Sem** teste de kill durante a escrita (Maestro, RNF-02) |
| C10 | ok | `fase5/treinoAtivo` ("descanso"), `fase5/restTimer` |
| C11 | ok (novo) | `restTimer` (vibra uma vez) + `fase9/aceiteT006` C11: tempo em tinta → laranja `hugger` ao zerar (Papel e Noite), vibra 1×. **Obs.:** só o número do tempo fica laranja, não a linha toda |
| C12 | ok (novo) | `fase4/repositorioTreino` (dados) + `fase9/aceiteT006` C12: a lápis (`inkMuted`), 1 toque grava, 3ª série cai no alvo, ativo/excluído não valem |
| C13 | **lacuna** | `ActiveWorkoutScreen` não passa `destaque` à `Linha`; só o catálogo usa. Sonda em `aceiteT006` C13 confirma que nenhum `stripeWash` aparece no treino ativo. `it.todo` registrado |
| C14 | ok | `treinoAtivo` (finalizar), `regrasTreino` (RN-05/06), `repositorioTreino` |
| C15 | ok | `treinoAtivo` ("seta para baixo minimiza") |
| C16 | sem teste (não existe) | só "Remover exercício" tem teste (`treinoAtivo`) |
| C17 | sem teste (não existe) | — |
| C18 | sem teste (não existe) | — |
| C19 | sem teste (não existe) | — |
| C20 | sem teste (decisão pendente) | `repositorioTreino` cobre o tipo A/D/F só no repositório |
| C21 | parcial | `treinoAtivo` ("+ Adicionar exercício … escolher e confirmar"), `t005/telasRotina` (busca). Falta teste explícito de busca sem acento e do rótulo "Adicionar N exercícios" |
| C22 | sem teste (não existe) | — |
| C23 | sem teste (não existe) | — |
| C24 | sem teste | tamanho do catálogo embarcado (10 vs ~20) não é verificado por teste |
| C25 | ok | `fase6/telaResumo`, `fase6/resumo` |
| C26 | ok | `fase7/historicoTela`, `historicoDados`, `repositorioRetro` |
| C27 | ok | `fase7/treinoPassado` (editar, recalcular, excluir com Sheet) |
| C28 | ok | `fase7/treinoPassado` ("repetir este treino"), `repositorioTreino` ("repetir"). O fluxo no aparelho segue por fazer |
| C29 | sem teste (não existe) | — |
| C30 | ok | `fase8/progressoTela`, `progressoSeries`, `grafico`, `regrasTreino` (Epley) |
| C31 | ok | `fase8/exercicioTela`, `exercicioRecords`, `exercicioSugestao`, `exercicioData` |
| C32 | parcial | `exercicioTela` ("como fazer": só verifica o aviso "ainda não disponível") |
| C33 | ok | `t005/telasRotina`, `componentesRotina`, `rotinaParseReps` |
| C34 | sem teste (não existe) | — |
| C35 | sem teste (não existe) | — |
| C36 | sem teste (decisão: manter botões) | `t005/telasRotina` ("remover e mover exercício") cobre os botões |
| C37 | sem teste (não existe) | — |
| C38 | ok | testes "offline"/"sem rede" em `treinoAtivo`, `telaResumo`, `historicoTela`, `treinoPassado`, `exercicioTela`, `progressoTela`, `t005/telasRotina` |
| C39 | sem teste | só no aparelho (modo avião) ou Maestro |
| C40 | parcial | `caderno` (stripeWash nos 2 temas), `grafico` e `faixaRetomar` (Noite), `t005/telasRotina` (fluxo em Noite), `RootTabs` (troca de tema), `theme`, `ThemeProvider`, `regrasDesignSystem`. Falta Noite nas telas de treino, resumo, histórico, progresso, exercício |
| C41 | parcial | `i18n.test`, `RootTabs` ("em inglês"), todos os testes rodam em pt-BR. Não verifica o aparelho em pt-BR |
| C42 | ok (novo) | `fase9/aceiteT006` C42 mede botões, caixinhas e abas de Treinar (com faixa Retomar), Treinar em edição, Histórico, Progresso, Perfil, editor de rotina e treino ativo com Sheet; já havia por tela em `treinoAtivo`, `telaResumo`, `historicoTela`, `treinoPassado`, `exercicioTela`, `progressoTela`. **Limite:** o teste lê `minHeight`/`height` do estilo; não mede o layout real no aparelho |
| C43 | parcial + **lacuna** | tombstone: ok (`repositorioTreino`, `treinoPassado`, `telasRotina`, `fase9/aceiteT006` C43). Regra `isPurgeable` (30 d): ok em `regrasTreino` e `aceiteT006`. **Lacuna:** nada no app chama `isPurgeable`; não há limpeza física dos tombstones (`it.todo` registrado) |
| C44 | parcial | `fase4/migracaoV3`, `fase8/migracaoV4`, `t005/revisaoSergio` (v2 congelada). Banco em memória; SQLite real só no aparelho (visto em 25/11) |
| C45 | parcial | `inicioTreinar` + `treinoAtivo` cobrem os passos; nenhum teste conta toques de ponta a ponta |
| C46 | ok | suíte completa: 47 suítes, 531 passam, 2 todo (rodada de 2026-11-26) |

## Resumo
- Sem teste porque a funcionalidade não existe (vão para T-006a a T-006d): C16, C17, C18, C19, C22, C23, C29, C34, C35, C37.
- Sem teste por decisão pendente: C20, C36. Só no aparelho: C39.
- Lacunas reveladas por teste: **C13** (faixa da série da vez não existe no treino ativo) e **C43** (sem limpeza de tombstones após 30 dias).
- Parciais a fechar: C09 (kill), C21, C24, C32, C40, C41, C44, C45.
