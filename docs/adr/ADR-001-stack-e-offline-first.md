# ADR-001 — Stack e estratégia offline-first

- **Status:** aceita (PO: Atlas, 2026-10-14) — pode ser revista pelo usuário
- **Contexto:** perguntas em aberto do documento de requisitos (pág. 17).

## Decisões
1. **Expo (managed + dev client)** em vez de RN CLI puro: build/OTA mais simples; o dev client
   permite módulos nativos (WatermelonDB, notificações, keep-awake).
2. **WatermelonDB** como banco local: protocolo pull/push pronto, que mapeia direto para
   `/api/v1/sync/pull` e `/api/v1/sync/push` no Spring Boot.
3. **Spring Boot 3.x + Java 17 + Maven wrapper** (JDK 17 é o instalado na máquina).
4. **PostgreSQL 16** via Docker Compose em dev; **Testcontainers** nos testes de integração.
5. **Auth:** access token JWT curto + refresh token; no app, armazenados com `expo-secure-store`
   (Keychain/Keystore). Token expirado pausa o sync, nunca o uso do app (RF-05).
6. **Sync:** `server_version` como sequência global no Postgres; `sync_push_log(client_op_id)`
   para idempotência; conflitos conforme RN-21, resolvidos no servidor.

## Em aberto (decisão do usuário)
- Catálogo de exercícios próprio ou licenciado.
- Modelo de receita do Premium.
- Ranks públicos / social.
