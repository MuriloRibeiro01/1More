# 1more — App de Treino offline-first

Registrador de treino de academia que **nunca perde uma série**. IDs de requisito: RF-xx, RNF-xx, RN-xx.

## Documentos de referência (`docs/`) — leia o que tocar no seu escopo
Cada PDF tem uma versão `.txt` pesquisável ao lado (use o `.txt` para ler/grep).
| Documento | Conteúdo | Quem usa |
|-----------|----------|----------|
| `requisitos.txt` (PDF "App de Treino — Pesquisa…") | RF/RNF/RN, arquitetura de sync, modelo de dados, roadmap | Todos |
| `1More-Design-System.txt` | Direção visual "Garagem 69", tokens de cor (Papel/Noite), tipografia, 31 componentes com props | Prisma, Sérgio, Dumont |
| `1More-Guia-React-Native.txt` | `theme.ts` pronto, fontes Expo, tradução dos padrões web→RN, comportamento obrigatório da tela de treino, ordem de implementação dos componentes | Prisma, Sérgio |
| `1More-icones/1more-icons/` | 32 ícones oficiais: `Icon.tsx` (RN), `icons.json`, SVG, PNG claro/escuro, `LEIA-ME.md` | Prisma, Sérgio |
| `1More-Prototipo-MVP.txt` | 11 telas, navegação, contagem de toques, interações e requisitos por tela | Prisma, Dumont, Atlas |

### Resumo do design (detalhes nos docs)
- 4 abas fixas e nesta ordem: **Treinar · Histórico · Progresso · Perfil** (RNF-08).
- Temas **Papel** (claro, padrão) e **Noite** (escuro). Cores só via `theme.ts`, nunca hex solto.
- Fontes: Racing Sans One (títulos/botões, caixa alta), Barlow Condensed (rótulos), Barlow (texto), IBM Plex Mono (todo número). No RN o peso vem do `fontFamily`, nunca `fontWeight`.
- Sem gradiente, sem sombra difusa, sem pílula, sem emoji; raio máx. 4px; alvo de toque ≥ 48dp.
- Escolhas/confirmações em `Sheet` (de baixo), nunca diálogo central. Offline é estado normal, nunca erro.
- Componentes RN com os **mesmos nomes e props** do Design System.
- Texto pt-BR direto ("você"), botões são verbos, números em formato pt-BR (`82,5 kg`, `80 × 10`).

## Stack
| Camada   | Tecnologia                                                                  | Pasta      |
|----------|-----------------------------------------------------------------------------|------------|
| Mobile   | React Native (Expo + dev client), TypeScript, WatermelonDB (SQLite local)   | `mobile/`  |
| Backend  | Spring Boot 4.0.x (Java 17; T-001 ainda em 3.5.16, migração na T-001b — ADR-002), Web, Security (JWT), Data JPA, Flyway, Actuator    | `backend/` |
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
| Sócrates  | Documentação             | Todos os READMEs (raiz, `backend/`, `mobile/`), `docs/guias/`, glossário — explicar o projeto para humanos. Os devs revisam a exatidão técnica dos READMEs das suas pastas |

### Fluxo de uma tarefa
1. Atlas cria a tarefa em `docs/tasks/` (ex.: `T-001-*.md`) com critérios de aceite e delega.
2. Dev pede branch ao Homero (`feat/T-001-descricao`); Dumont escreve os testes de aceite (a partir do T-002, ver TDD); dev implementa em ciclo TDD.
3. Dev → **Dumont** (testes) → **Leônidas** (se tocar auth, dados pessoais, rede ou deps) → **Sérgio** (review).
4. Aprovado → **Sócrates** atualiza a documentação da entrega (`docs/guias/`, `README.md`) → **Homero** faz commit/merge em `main` (código + docs) → avisa Atlas.
5. **Qualquer agente que encontrar um ponto de atenção** encaminha direto ao agente responsável
   (`maestri ask "Nome" "..."`), espera a correção e retoma o próprio trabalho. Atlas só entra
   em decisões de produto/escopo ou impasses.

### TDD (obrigatório a partir do T-002)
- **Regras de negócio e sync** (RN-xx: volume, 1RM, PR, XP, streak, progressão, conversão kg/lb, datas/semana;
  motor de sync, idempotência, conflitos RN-21, tombstones; regras de autorização no backend): ciclo
  **vermelho → verde → refatorar**. Nenhuma linha de produção sem um teste falhando antes.
- **Antes do dev começar**, o Dumont escreve os testes de aceite a partir dos critérios da tarefa
  (`docs/tasks/T-xxx`) e entrega ao dev, que os faz passar e adiciona os testes unitários do próprio ciclo.
- **Telas/componentes**: teste de componente (React Native Testing Library) escrito junto com o componente,
  cobrindo comportamento e acessibilidade (rótulos, `accessibilityState`, alvo ≥ 48dp).
- O Homero só commita quando a suíte está verde. O Sérgio **bloqueia** código de regra de negócio/sync
  sem teste correspondente ou com teste escrito depois e só "confirmando" o código.
- O T-001 (fundação) está isento; o fluxo de testes depois do código vale só para ele.

### Convenções
- Commits: Conventional Commits (`feat(mobile): ...`, `fix(backend): ...`), referenciando a tarefa.
- Só o Homero executa `git commit`, `merge`, `push`. Os demais apenas editam arquivos.
- Ninguém edita fora do próprio escopo sem combinar com o dono da pasta.
- Status da tarefa é atualizado no próprio arquivo em `docs/tasks/` (seção "Status").

## Comandos
```bash
docker compose -f infra/docker-compose.yml up -d     # PostgreSQL local (porta 5433 no host; ajustável via POSTGRES_PORT)
cd backend && ./mvnw spring-boot:run                 # API em http://localhost:8080
cd backend && ./mvnw test                            # testes backend (Testcontainers)
cd mobile && npx expo start                          # app
```
