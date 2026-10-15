# Changelog

O que mudou em cada tarefa, em linguagem de gente. Detalhes técnicos nos guias e em `docs/tasks/`.

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
