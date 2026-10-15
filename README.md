# 1more

Registrador de treino de academia que **nunca perde uma série**. Cada série é gravada no aparelho no
momento do toque, e a nuvem é uma cópia, nunca um pré-requisito para salvar ou finalizar um treino.
Offline é o estado normal do app, não um erro.

> **Estado atual (T-001, fundação):** já existem o esqueleto da API (health público, resto 401), o schema
> V1 do banco e o app com as 4 abas, os temas Papel/Noite e os componentes de fundação. Ainda **não**
> existem login, sync, catálogo nem registro de treino. Veja o [CHANGELOG](docs/guias/CHANGELOG.md).

## Stack

| Camada  | Tecnologia | Pasta |
|---------|------------|-------|
| Mobile  | React Native 0.86 + Expo SDK 57 (dev client), TypeScript, WatermelonDB (SQLite local), i18next | `mobile/` |
| Backend | Spring Boot 3.5.16 (migração para 4.0.x na T-001b, [ADR-002](docs/adr/ADR-002-spring-boot-4.md)), Java 17, Maven wrapper, Spring Security, Data JPA, Flyway, Actuator | `backend/` |
| Banco   | PostgreSQL 16 (Docker Compose em dev; Testcontainers nos testes) | `infra/` |

## Rodar em 5 minutos

Pré-requisitos: Docker Desktop, JDK 17, Node.js (testado com 24) e, para o app, Android Studio com um
emulador ou um aparelho com depuração USB. Detalhes e problemas comuns em [como-rodar.md](docs/guias/como-rodar.md).

```bash
# 1. Banco (PostgreSQL 16 em 127.0.0.1:5433)
docker compose -f infra/docker-compose.yml up -d

# 2. API (http://localhost:8080, perfil dev)
cd backend && ./mvnw spring-boot:run          # Windows/PowerShell: .\mvnw.cmd spring-boot:run
curl http://localhost:8080/actuator/health    # {"status":"UP",...}

# 3. App (em outro terminal)
cd mobile && npm install
npm run android        # 1ª vez: gera android/ e instala o dev client (não roda no Expo Go)
npx expo start         # depois: só o Metro
```

Testes: `cd backend && ./mvnw test` (precisa do Docker ligado) e
`cd mobile && npm test && npm run typecheck && npm run lint`.

## Mapa da documentação

| Quero… | Leia |
|--------|------|
| Entender o produto, personas e escopo do MVP | [docs/guias/visao-geral.md](docs/guias/visao-geral.md) |
| Ver como as peças se encaixam (offline-first, sync) | [docs/guias/arquitetura.md](docs/guias/arquitetura.md) |
| Rodar, configurar portas/variáveis, resolver erros no Windows | [docs/guias/como-rodar.md](docs/guias/como-rodar.md) |
| Mexer na API ou no banco | [docs/guias/backend.md](docs/guias/backend.md) · [backend/README.md](backend/README.md) |
| Mexer no app | [docs/guias/mobile.md](docs/guias/mobile.md) · [mobile/README.md](mobile/README.md) |
| Saber o que significa um termo (tombstone, server_version…) | [docs/glossario.md](docs/glossario.md) |
| Ver o que mudou em cada tarefa | [docs/guias/CHANGELOG.md](docs/guias/CHANGELOG.md) |
| Entender por que uma decisão foi tomada | [docs/adr/](docs/adr/) |
| Ver tarefas, critérios de aceite e riscos | [docs/tasks/](docs/tasks/) · [BACKLOG.md](docs/tasks/BACKLOG.md) |

Documentos de referência (insumo do produto, em PDF com versão `.txt` pesquisável ao lado):

| Documento | Conteúdo |
|-----------|----------|
| [`docs/requisitos.txt`](docs/requisitos.txt) | Pesquisa de mercado, RF/RNF/RN, arquitetura de sync, modelo de dados, roadmap |
| [`docs/1More-Design-System.txt`](docs/1More-Design-System.txt) | Direção visual "Garagem 69", tokens, tipografia, 31 componentes |
| [`docs/1More-Guia-React-Native.txt`](docs/1More-Guia-React-Native.txt) | `theme.ts`, fontes, tradução web→RN, ordem de implementação |
| [`docs/1More-Prototipo-MVP.txt`](docs/1More-Prototipo-MVP.txt) | 11 telas, navegação, contagem de toques |
| [`docs/1More-icones/1more-icons/`](docs/1More-icones/1more-icons/LEIA-ME.md) | 32 ícones oficiais (RN, SVG, PNG) |

## Regras que não se negociam

- **RN-01 / RNF-01:** nenhuma ação de treino espera a rede. A UI lê e grava só no banco local.
- **RNF-02:** cada série concluída é persistida em transação antes de a UI confirmar.
- IDs UUID v7 gerados no cliente; exclusão sempre lógica (tombstone); carga sempre em kg com 2 casas;
  datas em UTC + fuso.
- API versionada em `/api/v1`; migrações só via Flyway, e migração mergeada nunca é alterada.

Convenções do time (fluxo de tarefa, TDD a partir do T-002, commits) estão no [CLAUDE.md](CLAUDE.md).
