# T-001 — Fase 0: fundação dos projetos

**Responsáveis:** Tesla (backend), Prisma (mobile), Homero (git), Dumont (testes), Leônidas, Sérgio
**Requisitos:** RNF-16, RNF-17, RNF-18, ADR-001

## Escopo
### Backend (Tesla) — `backend/`
- Projeto Spring Boot 3 / Java 17 / Maven wrapper, pacote base `com.onemore`.
- Dependências: Web, Security, Data JPA, Validation, Flyway, Actuator, PostgreSQL, Testcontainers.
- `application.yml` lendo datasource de variáveis de ambiente (ver `.env.example`).
- Migração `V1__baseline.sql` com `app_user`, `user_settings` e `sync_push_log` + sequência global `server_version_seq`.
- `GET /actuator/health` respondendo UP com o Postgres do `infra/docker-compose.yml`.
- Teste de integração com Testcontainers subindo o contexto.

### Mobile (Prisma) — `mobile/`
- Projeto Expo + TypeScript (template blank-typescript), dev client configurado.
- Estrutura de pastas: `src/{screens,components,db,sync,theme,i18n}`.
- WatermelonDB instalado e configurado com schema vazio inicial + migrations.
- Navegação base (abas: Treino, Histórico, Exercícios, Perfil) com telas placeholder.
- Tema claro/escuro e i18n pt-BR/en.

## Critérios de aceite
- [ ] `docker compose -f infra/docker-compose.yml up -d` + `./mvnw spring-boot:run` → health UP.
- [ ] `./mvnw test` verde.
- [ ] `npx expo start` abre o app com as 4 abas.
- [ ] Revisado por Sérgio; Leônidas sem pendências críticas; commit inicial feito por Homero.

## Status
- Aberta — 2026-10-14
