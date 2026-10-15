# 1more — App de Treino offline-first

Registrador de treino de academia que **nunca perde uma série**. Requisitos completos em
`docs/App de Treino — Pesquisa de Mercado e Levantamento de Requisitos.pdf`
(versão texto pesquisável: `docs/requisitos.txt`). IDs de requisito: RF-xx, RNF-xx, RN-xx.

## Stack
| Camada   | Tecnologia                                                                  | Pasta      |
|----------|-----------------------------------------------------------------------------|------------|
| Mobile   | React Native (Expo + dev client), TypeScript, WatermelonDB (SQLite local)   | `mobile/`  |
| Backend  | Spring Boot 3 (Java 17), Web, Security (JWT), Data JPA, Flyway, Actuator    | `backend/` |
| Banco    | PostgreSQL 16 (Docker), Testcontainers nos testes                           | `infra/`   |

Decisões de arquitetura ficam em `docs/adr/`. Leia antes de mudar algo estrutural.

## Regras inegociáveis
- **RN-01 / RNF-01**: nenhuma ação de treino espera rede. A UI lê e grava só no banco local; o sync roda em segundo plano.
- **RNF-02**: cada série concluída é persistida em transação antes de a UI confirmar.
- IDs são UUID v7 gerados no cliente. Toda tabela sincronizável tem `id, user_id, created_at, updated_at, server_version, deleted_at`.
- Exclusão é sempre lógica (tombstone). Carga sempre em kg (2 casas). Datas em UTC + fuso.
- API versionada em `/api/v1`. Migrações só via Flyway (nunca alterar migração já mergeada).

## Time (terminais no Maestri)
| Nome      | Papel                    | Escopo                                             |
|-----------|--------------------------|----------------------------------------------------|
| Atlas     | Orquestrador / PO        | Backlog, prioridade, critérios de aceite, decisões |
| Prisma    | Dev Frontend             | `mobile/`                                          |
| Tesla     | Dev Backend              | `backend/`, `infra/`                               |
| Homero    | Git Manager              | Branches, commits, merges, PRs, histórico          |
| Dumont    | Testes / QA              | Testes unitários, integração, E2E, modo avião      |
| Leônidas  | Segurança                | Auth, JWT, LGPD, OWASP, dependências               |
| Sérgio    | Code Review              | Revisão de qualidade e corretude antes do merge    |

### Fluxo de uma tarefa
1. Atlas cria a tarefa em `docs/tasks/` (ex.: `T-001-*.md`) com critérios de aceite e delega.
2. Dev pede branch ao Homero (`feat/T-001-descricao`) e implementa.
3. Dev → **Dumont** (testes) → **Leônidas** (se tocar auth, dados pessoais, rede ou deps) → **Sérgio** (review).
4. Aprovado → **Homero** faz commit/merge em `main` → avisa Atlas.
5. **Qualquer agente que encontrar um ponto de atenção** encaminha direto ao agente responsável
   (`maestri ask "Nome" "..."`), espera a correção e retoma o próprio trabalho. Atlas só entra
   em decisões de produto/escopo ou impasses.

### Convenções
- Commits: Conventional Commits (`feat(mobile): ...`, `fix(backend): ...`), referenciando a tarefa.
- Só o Homero executa `git commit`, `merge`, `push`. Os demais apenas editam arquivos.
- Ninguém edita fora do próprio escopo sem combinar com o dono da pasta.
- Status da tarefa é atualizado no próprio arquivo em `docs/tasks/` (seção "Status").

## Comandos
```bash
docker compose -f infra/docker-compose.yml up -d     # PostgreSQL local (porta 5432)
cd backend && ./mvnw spring-boot:run                 # API em http://localhost:8080
cd backend && ./mvnw test                            # testes backend (Testcontainers)
cd mobile && npx expo start                          # app
```
