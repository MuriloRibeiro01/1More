# Plano até o MVP

Autor: Atlas (PO) · 2026-11-25 · Base: `requisitos.txt` (escopo do MVP, roadmap Fases 0 e 1), `BACKLOG.md`, nota "Riscos — Atenção do usuário" e o teste ponta a ponta no Pixel_4a de 2026-11-25.

> **Estimativas são palpites de ordem de grandeza** (dias de trabalho do time de agentes, com revisão). Servem para ordenar, não para prometer data. Reestimar ao fim de cada fase.

## Ponto de partida (verificado)
- **Funciona:** rotinas (T-005), treino ativo com séries e timer, retomada após force-stop (RNF-02), finalizar com resumo, histórico (lista, mês, detalhe, editar, retroativo), progresso (1RM, melhor série, volume, PR), temas, banco local com migração.
- **Decisão (2026-11-25):** a base é a `develop` atual. A `backup/t006-local` está **descartada**.
- **Não existe ainda:** conta, sync, backup/exportação, catálogo grande, build de release, backend integrado.
- **Dívida de processo:** a T-006 não tem `T-006.md`, revisão nem commit do trabalho recente. O Homero está parado.

## Marcos
| Marco | O que é | Quando considerar atingido |
|-------|---------|----------------------------|
| **M0 — Demo guiada** | Fluxo offline apresentável como protótipo funcional | Fase A concluída + APK de release |
| **M1 — MVP técnico** | Conta, sync, exportação, escopo Must fechado, release | Fases A, B, C e D1 concluídas |
| **M2 — MVP validado** | Critério de saída do roadmap | 30 dias de uso real sem treino perdido |

---

## Fase A — Guardar e validar o que existe (≈ 1 semana)
Objetivo: nenhum trabalho solto, T-006 dentro do fluxo do time.

| # | Tarefa | Dono | Aceite |
|---|--------|------|--------|
| A1 | Reativar o Homero (ou recriar o terminal). Branch `feat/T-006-caderno` a partir da `main`, commitar a `develop` atual + os consertos de 2026-11-25 (plugin `withWatermelonBuildConfig`, `app.json`, margem inferior, `NumberField`, `SemanaCaderno`, `repository.ts`, `rules.ts`, config de teste), merge `--no-ff` só após A2 | Homero | Árvore limpa; `main` contém a T-006 |
| A2 | `T-006.md` retroativo (critérios de aceite do que existe) → revisão: Dumont (suíte e lacunas), Leônidas (dependências novas e o CMake instalado por zip fora do sdkmanager), Sérgio (revisão por área, diff grande) | Atlas → Dumont, Leônidas, Sérgio | Aprovações registradas na seção Status |
| A3 | Roteiro de teste manual do que **não** testei: repetir treino, editar/apagar rotina, opções por exercício, tema Paper, pt-BR, modo avião, kill durante a série | Dumont | Roteiro executado; bugs viram tarefas |
| A4 | Documentar como rodar: wrapper `dev`/Spalla, exigência do CMake 3.31.6, workaround do AGP 9 (`BuildConfig`) | Sócrates | `mobile/README.md` reproduz o build do zero |
| A5 | Decisão pendente: manter ou remover reps mín/máx da T-005 (item 11 da nota de riscos) | Usuário | Registrado |

## Fase B — Dados seguros: backup, conta e sync (≈ 4 a 6 semanas)
Gatilho da nota de riscos (item 2): "voltar à fundação no máximo depois de 2-3 features". Já passamos disso.

| # | Tarefa | Dono | Nota |
|---|--------|------|------|
| B0 | **Exportar dados CSV/JSON (RF-51, Must)** — antes do sync, como rede de segurança (mitiga o risco 1) | Prisma (+ Dumont) | ≈ 3 dias. Dá backup manual desde já |
| B1 | **T-001b** — migrar para Spring Boot 4.0.x (R-02, ADR-002) | Tesla; Leônidas e Sérgio | ≈ 3 a 5 dias. Bloqueia expor API |
| B2 | **T-002 — Autenticação** (RF-01 e-mail/senha, RF-05, RF-06 excluir conta, RNF-11; R-03 e R-10) | Dumont (testes) → Tesla + Prisma; Leônidas | ≈ 1 a 1,5 semana. Google/Apple ficam depois (ver decisões) |
| B3 | **Pré-requisitos do sync:** decidir idioma das colunas (item 5), teste de kill no iOS (R-12), revisar identidade de `routine_exercise` (R-13) | Atlas, Prisma, Sérgio | Antes de abrir a T-003 |
| B4 | **T-003 — Motor de sync** (pull/push, RN-21, idempotência por `client_op_id`, tombstones; R-01, R-04, R-06, R-08) | Dumont (testes) → Tesla + Prisma; Leônidas | ≈ 2 a 3 semanas. É o item mais arriscado e mais caro de refazer |
| B5 | Indicador de estado do sync (RF-52), sync manual (RF-53), mesma conta em 2 aparelhos (RF-54) | Prisma, Tesla | Depois da B4 |

## Fase C — Fechar o escopo Must do MVP (≈ 3 a 4 semanas, em paralelo parcial com B)
Verificar o estado de cada item antes de abrir tarefa (alguns podem já existir no app).

| # | Item | Nota |
|---|------|------|
| C1 | **T-004 Catálogo embarcado** (RF-10, RF-11, RN-19) | Hoje são 10 exercícios. Meta de partida: ~100 em texto, sem mídia. Depende da decisão de licença (item 8) |
| C2 | Exercício personalizado (RF-12), tipos de registro (RF-13) | |
| C3 | Notas por exercício e por treino (RF-38, Must) | Nota do treino já existe no resumo; conferir a por exercício |
| C4 | Tipos de série e superséries (RF-22 Must, RF-23) | RF-22 é grande: propor corte (ver decisões) |
| C5 | Timer com notificação em segundo plano (RF-35) | Conferir o que existe |
| C6 | Onboarding e perfil (RF-03, RF-04), unidades kg/lb (RF-71) | |
| C7 | **LGPD**: consentimento, histórico de consentimento (R-05), exclusão pelo app, política de privacidade (item 7) | Antes de qualquer usuário real e de qualquer tela de peso/medidas (RF-46) |
| C8 | RF-64 desligar gamificação | Só se streak/XP entrarem no MVP |

## Fase D — Release e prova de uso (≈ 2 semanas + 30 dias)
| # | Tarefa | Dono |
|---|--------|------|
| D1 | Build de release instalável (Android primeiro): keystore, ícone, splash, assinatura; desligar o dev client e o Metro | Prisma |
| D2 | CI com testes de kill e modo avião (item da Fase 0 do roadmap) | Dumont |
| D3 | Backend publicado: TLS, segredos fora do repo (R-05/item 10), banco gerenciado, backup, só depois da B1 | Tesla, Leônidas |
| D4 | Relatório de falhas do app (sem dado pessoal, respeitando a LGPD) | Prisma, Leônidas |
| D5 | **Beta fechado: 2 a 3 pessoas por 30 dias**; métrica única: treino perdido = 0 | Usuário, Atlas |

---

## Caminho crítico
`A1/A2` → `B0` → `B1` → `B2` → `B3` → `B4` → `D1/D3` → `D5`. A Fase C corre ao lado da B (Prisma na C, Tesla na B), exceto C7, que precisa da B2.

## Riscos que este plano toca (nota de riscos)
| Item | Como o plano trata |
|------|--------------------|
| 1 Dados só no aparelho | B0 (exportação) já; B4 (sync) depois |
| 2 Sync adiado | Fase B começa logo após a A |
| 3 / R-12 WatermelonDB | B3: teste de kill no iOS antes da T-003 |
| 4 / R-02 Spring Boot 3.5 | B1 antes de qualquer deploy |
| 5 Idioma das colunas | Decidir em B3 |
| 7 LGPD | C7 |
| 8 Catálogo e mídia | C1 em texto; mídia só com licença |
| 11 Reps mín/máx | A5 |

## Decisões que preciso do usuário
1. **Escopo:** MVP = Fase 1 do roadmap (sem streak, XP e conquistas, que o roadmap põe na Fase 2)? O texto do escopo cita streak e XP dentro do MVP, mas o roadmap os põe na Fase 2.
2. **Backup antes do sync:** fazer a exportação (B0) primeiro?
3. **Idioma das colunas:** padronizar em inglês com uma migração Flyway nova (ainda não há dado em produção)?
4. **Catálogo:** base própria em texto para o MVP, sem imagens nem GIFs?
5. **Plataforma:** beta só em Android, e iOS depois? (R-12 pede ao menos um teste de kill no iOS.)
6. **Login:** só e-mail/senha no MVP? Se entrar Google no iOS, a Apple exige "Entrar com Apple".
7. **Superséries (RF-22, Must):** cortar do primeiro MVP ou manter?
8. **A5:** reps mín/máx ficam ou saem?

## Não está neste plano
Relógio, social, IA, módulo de personal, nutrição, Apple Health/Health Connect (Fase 3); importação Strong/Hevy, lembretes, progressão sugerida (Fase 2).
