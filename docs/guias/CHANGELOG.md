# Changelog

O que mudou em cada tarefa, em linguagem de gente. Detalhes técnicos nos guias e em `docs/tasks/`.

## T-006b — Letra da rotina e pastas · 2026-11-27

- **Mobile, 100% local:** a rotina ganha a letra (A, B, C…) na margem do editor e da lista; a nova pega a próxima livre. Dá para criar, renomear e excluir pastas em "Editar rotinas" e escolher a pasta no editor (excluir a pasta deixa as rotinas sem pasta). Schema WatermelonDB v6 (`routine_folder` e `routine.folder_id`). Superset (RF-22) segue em aberto, decisão do PO.

## T-006c — Filtros e exercício próprio · 2026-11-27

- **Mobile:** o seletor de exercícios filtra por músculo e por equipamento (combinando com a busca) e permite criar, editar e arquivar o próprio exercício (nome vazio ou repetido é recusado). Schema v5 (`exercise.is_custom`). O catálogo embarcado tem 16 exercícios (`src/routines/catalog.ts`); a ampliação é da T-004.

## T-006a — Lacunas do treino ativo · 2026-11-27

- **Mobile:** a série da vez ganha faixa de destaque; as opções `···` do exercício passam a ter "Trocar exercício" (as séries concluídas ficam no exercício antigo) e "Ver histórico e recordes".
- **Nativo:** o descanso agenda uma **notificação local** ("Descanso acabou", sem dado pessoal; permissão pedida uma vez por treino; negada não bloqueia) e a tela fica **ligada** durante o treino ativo, mesmo minimizado. Novos módulos `expo-notifications` e `expo-keep-awake`: exigem `prebuild` e novo dev client.

## T-006e — Ajustes das revisões · 2026-11-26

- Finalizar com séries pendentes sem reps agora descarta essas séries (tombstone) e o fim do treino é a última série realmente concluída (S1, RN-03); recorde de carga ignora 0 kg em exercício de peso corporal; semana (treino e músculos) pelo fuso gravado no treino (RN-24); datas da tela Exercício no idioma do app; token de largura do `Stepper` em `theme/layout.ts`; `zod` atualizado (alerta alto do `npm audit`, só dev).
- **Expurgo (RN-20):** exclusões lógicas com 30 dias ou mais são apagadas ao abrir o app (`src/db/purge.ts`). **Nota T-003:** a regra não olha o sync; antes do sync, ela precisa expurgar só o que o servidor já confirmou (RN-21).

## T-006 — Caderno: treino ativo, histórico e progresso · 2026-11-12 (docs: 2026-11-26)

- **Mobile, 100% local:** novo visual de caderno e navegação em pilha sobre as 4 abas. Dá para treinar a partir de uma rotina (série concluída com 1 toque, descanso, retomar treino), ver o resumo, consultar e editar o histórico (inclusive treino passado), acompanhar o progresso (1RM, melhor série, volume) e abrir a tela de cada exercício. Schema WatermelonDB v4.
- Entrega retroativa: 21 de 46 critérios conferidos no aparelho; o restante (superset, trocar exercício, notificação do descanso, filtros do catálogo etc.) está em aberto em `docs/tasks/T-006-frontend-caderno.md`. Build Android agora exige o plugin `mobile/plugins/withWatermelonBuildConfig.js` e o CMake 3.31.6 (ver `mobile/README.md`).
- Correções de 2026-11-25 (validação no Pixel_4a): BuildConfig do WatermelonDB e CMake no build Android; `SemanaCaderno` sem `Intl.RelativeTimeFormat` (não existe no Hermes); margem inferior dos botões coberta pela barra de navegação; campo de peso (`0` inicial e dígitos que se substituíam).

## T-005 — Planilha de treino (rotinas) · 2026-10-18

- **Mobile, 100% local:** na aba Treinar dá para criar, editar e excluir rotinas (exclusão lógica). Os exercícios vêm de um catálogo embarcado com 16 itens e busca que ignora acento. Cada exercício tem 1–10 séries, carga em kg com vírgula, reps mín/máx e descanso de 15 em 15 s.
- WatermelonDB no schema v2 (`exercise`, `routine`, `routine_exercise`, `routine_set`, já com colunas de sync e UUID v7), com o passo de migração congelado. Novos componentes do DS: `Stepper`, `NumberField`, `TextField`, `Sheet`, `EmptyState`, `RoutineCard`. O "voltar" do Android só age com a aba Treinar em foco.
- Aprovado em TDD: testes de aceite do Dumont antes do código, suíte 179/179, piloto offline no emulador, review do Sérgio. Detalhes em `docs/tasks/T-005-planilha-de-treino.md`.

## T-001 — Fundação (Fase 0) · 2026-10-14

**Backend** — aprovado (testes: Dumont, 53/53 · segurança: Leônidas, com ressalvas resolvidas · review: Sérgio)

- Projeto Spring Boot 3.5.16 / Java 17 / Maven wrapper com checksum, pacote `com.onemore`.
- Segurança mínima: `/actuator/health` (e probes liveness/readiness) público; todo o resto responde 401 até
  a T-002. API stateless, sem sessão, CSRF, form login ou Basic.
- Migração Flyway `V1__baseline.sql`: `app_user`, `user_settings`, `sync_push_log`, sequência global
  `server_version_seq` e trigger `set_server_version` (a versão sempre vem do servidor; tombstone também
  versiona).
- Perfil `dev` (só via `./mvnw spring-boot:run`) com defaults para o Postgres local; fora dele, datasource
  obrigatório por variável de ambiente.
- 53 testes de integração com Testcontainers (contrato do schema V1 e segurança da Fase 0).

**Infra**

- PostgreSQL 16 no Docker Compose publicado só em `127.0.0.1`, na porta **5433** do host
  (`POSTGRES_PORT`), para não colidir com um PostgreSQL nativo na 5432.

**Mobile** — aprovado em 2026-10-15 (testes: Dumont, 83/83 · segurança: Leônidas, com ressalvas resolvidas ·
review: Sérgio)

- Projeto Expo SDK 57 / RN 0.86 (New Architecture) + dev client + TypeScript, com WatermelonDB configurado
  (schema vazio, JSI) pelo plugin `@lovesworking/watermelondb-expo-plugin-sdk-52-plus` 1.0.3.
- `allowBackup: false` no Android: o banco local não vai para backup.
- `theme.ts` do Guia RN, temas Papel/Noite/sistema com troca manual salva no aparelho, fontes embarcadas.
- Componentes de fundação: `Icon`, `Button`, `IconButton`, `TopBar`, `TabBar`.
- 4 abas fixas Treinar · Histórico · Progresso · Perfil, com telas provisórias.
- i18n pt-BR (padrão) e en, com números no formato pt-BR.
- Lint que bloqueia cor solta, `fontWeight` e sombra difusa.
- 83 testes (jest + RNTL) em `mobile/__tests__/`: tema idêntico ao Guia, regras do Design System, tema e
  persistência, i18n e formatação, componentes e abas.

**Decisões e riscos**

- ADR-002: migrar para Spring Boot 4.0.x na T-001b (fim do suporte OSS da 3.5).
- Riscos registrados no BACKLOG: R-01 (ordem do `server_version`), R-02 (Boot 3.5, resolvido pela
  T-001b), R-03 a R-05 (segurança para T-002/T-003/LGPD), R-06 (tombstone de `user_settings`), R-07 (porta
  do Postgres, fechado), R-08 (versão em todo UPDATE e resposta do push), R-09 (`app_user` fora do padrão
  de tabela sincronizável), R-10 (segurança mobile do T-002 em diante) e R-11 (pendências de UI do mobile).

**Documentação**

- `README.md` da raiz, `docs/guias/` (visão geral, arquitetura, como rodar, backend, mobile, changelog) e
  `docs/glossario.md`.
