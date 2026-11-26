# T-006 — Frontend do caderno: treino ativo, histórico e progresso

**Tarefa retroativa.** O código foi entregue em 2026-11-12 (PR #1, merge `3fdd66b`) sem arquivo de tarefa. Este documento foi aberto em 2026-11-26 e **parte do protótipo, não do código**: os critérios abaixo são os do protótipo e do plano, e cada um foi conferido contra o app real. O que ficou marcado como aberto é o que falta.
**Responsáveis:** Dumont (testes de aceite e roteiro manual) → Prisma (mobile) → Leônidas (dependências e infraestrutura de build) → Sérgio (revisão) → Sócrates (docs) → Homero.
**Fora:** Tesla, backend e sync. Tudo é local (modo sem conta, RF-02).
**Requisitos:** RF-10 a RF-15, RF-20 a RF-24, RF-30 a RF-38, RF-40 a RF-45, RF-47, RN-02 a RN-13, RN-20, RN-24, RNF-01, RNF-02, RNF-08, RNF-09, RF-72.
**Referências:** `docs/1More-Prototipo-caderno.txt` (protótipo do caderno, 12 nov 2026, 11 telas) e `actions/PLANO-FRONTEND-CADERNO.md` (plano em fases 0 a 10).

## História
Como pessoa que treina, quero registrar o treino numa tela que lembra um caderno: poucos elementos, uma linha por série, um toque para concluir, e ver depois meu histórico e meu progresso, tudo sem precisar de rede.

## Escopo desta tarefa (fases 1 a 8 do plano)
Linguagem visual do caderno, navegação em pilha sobre as 4 abas, tela Treinar, treino ativo, treino finalizado, histórico, treino passado, progresso, tela de exercício e a migração das telas de rotina para o novo visual.

## Fora desta tarefa (têm tarefa própria no plano)
- **Perfil completo** (T-015 sugerida) e **Onboarding** (T-016 sugerida). Aparecem na tabela de lacunas porque faltam para o MVP, mas não são critérios daqui.
- **Acabamento e QA** (fase 10), que reaproveita o roteiro manual deste documento.
- Conta, sync e backend (T-002 a T-004).

## Como ler os critérios
`[x]` = conferido e correto. `[ ]` = falta ou não foi conferido; o texto diz qual dos dois.
Evidência: **[A]** visto no aparelho (Pixel_4a, 2026-11-25) · **[T]** coberto por teste automatizado · **[C]** só leitura de código ou de textos da interface.

## Critérios de aceite

### Linguagem visual e navegação
- [x] C01 Folha com a margem vermelha, linhas de 1 px, títulos grifados, tinta e lápis, um botão cheio por tela, sem cartões nem sombras. [A][T]
- [x] C02 Quatro abas fixas na ordem Treinar · Histórico · Progresso · Perfil (RNF-08); abas só nas 4 telas principais. [A][T]
- [x] C03 Faixa "Retomar" em qualquer aba com treino ativo, inclusive depois de fechar o app à força. [A]
- [ ] C04 Depois de 4 h parado, a faixa vira "Esqueceu de finalizar?" (RN-04). Implementado e testado; **não visto no aparelho**. [T]

### Treinar
- [x] C05 Rotina do dia em destaque (a há mais tempo sem fazer, RN-02), com o único botão cheio; "Nova rotina", "Editar rotinas" e "Treino livre". [A][T]
- [x] C06 Semana com os dias treinados e o dia de hoje marcado. [A]
- [ ] C07 Linhas das demais rotinas abrem o treino com 1 toque. Existe e tem teste; **não exercitado no aparelho** (só havia uma rotina). [T]

### Treino ativo
- [x] C08 Concluir a série com 1 toque grava no banco e inicia o descanso; carga e reps editáveis na própria linha. [A][T]
- [x] C09 Fechar o app à força no meio do treino e reabrir devolve as séries concluídas (RNF-02). [A] O teste automatizado de "kill durante a escrita" não existe.
- [x] C10 Descanso fixo no rodapé, com +15 s e Pular. [A]
- [ ] C11 Ao zerar o descanso, a linha fica laranja e vibra. Vibra (código); **a cor não foi conferida**. [C]
- [ ] C12 Valores da sessão anterior a lápis, usados ao tocar a caixinha (RF-31). Implementado; **não conferido no aparelho** (o `0` pré-preenchido indevido foi corrigido em 25/11). [T]
- [ ] C13 Série da vez numa faixa amarela. **Não apareceu nas telas que vi.**
- [x] C14 Finalizar com séries pendentes abre a folha (marcar, descartar, voltar); sem nenhuma série feita oferece descartar (RN-05, RN-06). [A][T]
- [x] C15 A seta para baixo minimiza o treino e volta para Treinar. [A]
- [ ] C16 Opções `···` do exercício: **Trocar exercício**. **Falta**; hoje só existe "Remover exercício". [C]
- [ ] C17 Opções `···` do exercício: **Ver histórico e recordes**, que abre a tela Exercício. **Falta.** [C]
- [ ] C18 Notificação local do descanso com o app fechado. **Falta**: `expo-notifications` não está no projeto. [C]
- [ ] C19 Tela sempre ligada durante o treino. **Falta**: `expo-keep-awake` não está no projeto. [C]
- [ ] C20 Seletor do tipo de série (A, D, F) ao tocar na margem. O protótipo não tem essa tela; a margem só exibe a letra. **Decisão pendente.**

### Catálogo (Adicionar exercício)
- [x] C21 Lista de verificação com a caixinha na margem, busca sem acento e "Adicionar N exercícios". [A][T]
- [ ] C22 Filtros escritos por músculo e equipamento (RF-11). **Falta.** [C]
- [ ] C23 "+ Criar exercício próprio" (RF-12). **Falta.** [C]
- [ ] C24 Catálogo embarcado: a T-005 prometeu cerca de 20 exercícios e o app tem 10 (RF-10). **Parcial**, coberto pela T-004. [A]

### Treino finalizado
- [x] C25 Resumo em livro-caixa (duração, volume, séries, semana), carimbo PR nos recordes, nota opcional, "Salvo no aparelho" e Fechar. Duração vai do início à última série concluída (RN-03). [A][T]

### Histórico
- [x] C26 Lista por semana e visão de mês; "Registrar treino passado" por folha com Dia, Hora e Minuto (RN-07). Treino passado sem exercícios é descartado. [A]
- [x] C27 Treino passado em linhas de diário; Editar e Pronto recalculam volume e PR (100×12 e 20×10 deram 1.400 kg); Excluir com folha. [A] A exclusão em si só foi vista em teste. [T]
- [ ] C28 "Repetir este treino" em 3 toques desde o Histórico. O botão existe; **o fluxo completo não foi executado**. [A]
- [ ] C29 Atividades que não são musculação na mesma lista (RF-47). **Falta**; exige decisão de produto e uma migração v4.

### Progresso e Exercício
- [x] C30 Gráfico direto na folha, sem moldura; troca de exercício e de métrica (1RM, Melhor série, Volume); 1RM por Epley (100×12 deu 140 kg); linha de recorde abre o Exercício; séries por músculo na semana. [A]
- [x] C31 Tela Exercício com Recordes, Histórico, "Minha nota" e sugestão de carga só como sugestão (RN-12). [T][C]
- [ ] C32 "Como fazer" com a demonstração (RF-14). A tela diz "ainda não disponível"; **depende de decisão de conteúdo e licença.**

### Editar rotina
- [x] C33 Nome, exercícios com os ajustes abaixo, séries e descanso com −/+, carga alvo, reps mín e máx, remover, mover para cima e para baixo, salvar e descartar com folha. [A][T]
- [ ] C34 Letra da rotina (A, B, C) na margem do editor. **Falta.** [C]
- [ ] C35 Superset: a margem vira 3a/3b (RF-22, prioridade Must). **Falta.** [C]
- [ ] C36 Reordenar por arrastar (`≡`). No protótipo é só visual; hoje existem os botões de subir e descer. **Decisão: manter os botões.**
- [ ] C37 Pastas de rotinas (RF-24, prioridade Should). **Falta.** [C]

### Transversais
- [x] C38 Nenhuma tela faz chamada de rede (RNF-01, RN-01). [T]
- [ ] C39 Todo o fluxo em modo avião, no aparelho. **Não verificado.**
- [ ] C40 Temas Papel e Noite em todas as telas. Noite visto só no Perfil; **as demais telas não foram conferidas no tema escuro.** [A]
- [ ] C41 Interface em pt-BR no aparelho. Os textos existem (240 linhas), mas o aparelho de teste estava em inglês; **não verificado.**
- [ ] C42 Alvos de toque ≥ 48 dp e uso com uma mão (RNF-09). Testes de componente cobrem parte; **medição nas telas não feita.** [T]
- [ ] C43 Destrutivo com exclusão lógica por 30 dias (RN-20). A exclusão lógica existe; **a retenção de 30 dias e a limpeza não foram verificadas.** [C]
- [x] C44 Migração do banco da v2 para a v4 num SQLite real. [A] (fecha uma pendência do plano, que só tinha testado em memória.)
- [x] C45 Contagem de toques: 1ª série em 2 toques (Começar treino e caixinha); voltar ao treino minimizado em 1 toque. [A]
- [x] C46 Suíte automatizada: 46 suítes, 512 testes, `tsc` e ESLint limpos (2026-11-26). [T]

## Lacunas, em ordem de prioridade para o MVP
| # | Lacuna (critérios) | Por que importa | Quem decide ou faz | Tarefa sugerida |
|---|--------------------|-----------------|--------------------|-----------------|
| 1 | Conferir no aparelho o que está marcado "não verificado" (C04, C07, C11 a C13, C28, C39 a C43) | É o que decide se a T-006 está pronta; custa só tempo de teste | Dumont | Roteiro manual (fase A do plano) |
| 2 | Superset (C35) | RF-22 é Must | Atlas decide o corte; Prisma | T-006b |
| 3 | Opções do exercício no treino: trocar e ver histórico (C16, C17) | Fluxo central de quem treina | Prisma | T-006a |
| 4 | Notificação local e tela ligada (C18, C19) | Timer inútil com o app em segundo plano; exigem dependências novas, novo dev client e revisão do Leônidas | Prisma, Leônidas | T-006a |
| 5 | Filtros e exercício próprio (C22, C23) e catálogo maior (C24) | RF-10 a RF-12 | Prisma | T-004 e T-006c |
| 6 | Atividades fora da musculação (C29) | Precisa de decisão e de migração v4 | Usuário, depois Prisma | T-006d |
| 7 | "Como fazer" (C32) | Depende de conteúdo e de licença de mídia | Usuário | decisão do ADR-001 |
| 8 | Letra, pastas e seletor de tipo de série (C34, C37, C20) | Acabamento; C20 e C36 estão fora do protótipo | Atlas | T-006b |
| 9 | Perfil completo e Onboarding | Fora desta tarefa, mas o MVP exige | Prisma, Leônidas | T-015, T-016 |

## Revisão e processo ainda não feitos
- **Dumont:** testes de aceite desta tarefa partindo dos critérios acima, e o roteiro manual da lacuna 1.
- **Leônidas:** dependências e infraestrutura introduzidas desde a entrega: atualização para o SDK 58, `@react-navigation/native-stack`, `react-native-svg`, o plugin local `mobile/plugins/withWatermelonBuildConfig.js` e o CMake 3.31.6, instalado no SDK a partir do zip oficial do Google (SHA-1 conferido pelo Prisma), fora do gerenciador do SDK.
- **Sérgio:** revisão do diff do PR #1, que é grande (100 arquivos), por área.
- **Sócrates:** `mobile/README.md` (como buildar e rodar, CMake, AGP 9), `docs/guias/mobile.md` e `CHANGELOG.md`.
- **Homero:** merge de `develop` na `main`, com `--no-ff`, só depois das aprovações.

## Status
- Entrega original (Prisma) — 2026-11-12: fases 1 a 8 do plano, em TDD, no PR #1 (merge `3fdd66b`). Sem arquivo de tarefa e sem revisão formal.
- Aberta, retroativa (Atlas) — 2026-11-26. Critérios extraídos do protótipo e conferidos contra o app.
- Validação em aparelho (Atlas), Pixel_4a, 2026-11-25: build e instalação, fluxo de rotina, treino, resumo, histórico, edição, progresso e perfil. Encontrados e **corrigidos** na `develop`: crash do `SemanaCaderno` (`Intl.RelativeTimeFormat` ausente no Hermes), botões inferiores cobertos pela barra de navegação (seletor de exercícios e editor de rotina), e campo de peso (`0` inicial e dígitos que se substituíam). Commits `051dd3f`, `97a0dcd`, `b74a214`, `0c8ca06`, `88f8cd6`.
- Testes — 2026-11-26: 46 suítes, 512 testes verdes em duas rodadas, `tsc` e ESLint limpos.
- **Situação:** 21 de 46 critérios conferidos e corretos. Dos 25 em aberto: 12 são lacunas de funcionalidade (C16, C17, C18, C19, C22, C23, C24, C29, C32, C34, C35, C37), 11 não foram verificados (C04, C07, C11, C12, C13, C28, C39 a C43) e 2 aguardam decisão (C20, C36).
- Pendentes: aceite do Dumont, revisão do Leônidas e do Sérgio, documentação do Sócrates, merge do Homero.
