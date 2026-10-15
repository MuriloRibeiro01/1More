# Como rodar

> Atualizado no T-001 (2026-10-14). Verificado nesta máquina com: Node 24.14, npm 11.11, Java 17.0.12,
> Docker 29.4 / Compose v5.1.

## Pré-requisitos

| Ferramenta | Para quê | Observação |
|------------|----------|------------|
| Docker Desktop | PostgreSQL de dev e Testcontainers | Precisa estar **rodando** antes de `./mvnw test` |
| JDK 17 | Backend | O Maven vem pelo wrapper (`mvnw`), não precisa instalar |
| Node.js + npm | App | Testado com Node 24 |
| Android Studio (SDK + emulador) ou aparelho com depuração USB | App | O app **não roda no Expo Go** (WatermelonDB é módulo nativo) |

## Passo a passo

### 1. Banco

```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps     # aguarde "healthy"
```

Sobe `postgres:16-alpine` (container `onemore-postgres`, volume `pgdata`) publicado **só em localhost**:
`127.0.0.1:5433` no host → 5432 no container (`infra/docker-compose.yml`).

### 2. API

```bash
cd backend
./mvnw spring-boot:run          # Git Bash / macOS / Linux
.\mvnw.cmd spring-boot:run      # PowerShell / cmd
```

A API sobe em `http://localhost:8080` com o perfil `dev`, e o Flyway aplica a `V1__baseline.sql` na
primeira execução. Para conferir:

```bash
curl http://localhost:8080/actuator/health        # {"status":"UP","components":{...}} no dev
curl -i http://localhost:8080/api/v1/qualquer     # 401 (normal até a T-002)
```

### 3. App

```bash
cd mobile
npm install
npm run android     # 1ª vez ou após mudar dependência nativa: expo run:android (gera android/ e instala o dev client)
npx expo start      # nas próximas vezes: só o Metro, abre no dev client já instalado
```

`android/` e `ios/` são gerados por `expo prebuild` e não vão para o git.

## Portas

| Serviço | Porta | Configurável por |
|---------|-------|------------------|
| PostgreSQL (dev) | `127.0.0.1:5433` | `POSTGRES_PORT` |
| API | `8080` | padrão do Spring Boot |
| Metro (Expo) | `8081` | padrão do Expo |

A porta do Postgres é **5433**, não 5432, porque esta máquina tem um PostgreSQL nativo na 5432 (BACKLOG R-07).

## Variáveis de ambiente

Modelo em `.env.example` na raiz. Copie para `.env` **na raiz** (não versionado) só se precisar mudar algo.
Sem `.env`, tudo funciona com os defaults abaixo.

| Variável | Usada por | Padrão |
|----------|-----------|--------|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Docker Compose | `onemore` / `onemore` / `onemore_dev` |
| `POSTGRES_PORT` | Docker Compose (porta do host) | `5433` |
| `SPRING_DATASOURCE_URL` | Backend | só no perfil dev: `jdbc:postgresql://localhost:5433/onemore` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | Backend | só no perfil dev: `onemore` / `onemore_dev` |
| `JWT_SECRET` | Backend, **a partir da T-002** | ainda não é lido pelo código |

Pontos importantes:

- **O perfil `dev` só é ativado por `./mvnw spring-boot:run`** (`backend/pom.xml:94`). Ele dá os defaults
  acima e mostra os detalhes do health. Fora dele (jar empacotado), as três `SPRING_DATASOURCE_*` são
  obrigatórias e o health não mostra detalhes.
- **O Spring Boot não lê o arquivo `.env` sozinho.** No dev os defaults de `application-dev.yml` já batem
  com o compose. Se você mudar a porta ou a senha, exporte as variáveis no terminal antes do
  `spring-boot:run`.
- **Com `-f infra/docker-compose.yml`, o Compose não lê o `.env` da raiz** (ele procura em `infra/`;
  verificado com o Compose v5.1). Se você criou um `.env`, suba o banco passando o arquivo:
  `docker compose --env-file .env -f infra/docker-compose.yml up -d`.

## Testes

```bash
cd backend && ./mvnw test                                   # 53 testes; Testcontainers sobe o próprio postgres:16-alpine
cd mobile && npm test && npm run typecheck && npm run lint  # 83 testes (jest), TypeScript e regras do Design System
```

O `./mvnw test` **não usa** o Postgres do compose: o Testcontainers cria um container descartável. Por isso
só precisa do Docker ligado. O `npm test` do mobile não precisa de emulador nem de banco.

## Problemas comuns (Windows)

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `Connection refused` / senha inválida na porta 5432 | O app está falando com o PostgreSQL nativo, não com o do compose | Use a 5433 (padrão do dev) ou mude `POSTGRES_PORT` e `SPRING_DATASOURCE_URL` juntos |
| `port is already allocated` ao subir o compose | Outra coisa na 5433 | `POSTGRES_PORT=5434` + `SPRING_DATASOURCE_URL` correspondente |
| `./mvnw test` falha com "Could not find a valid Docker environment" | Docker Desktop desligado | Abra o Docker Desktop e espere ficar "running" |
| `./mvnw` não é reconhecido no PowerShell | O script é para shell POSIX | Use `.\mvnw.cmd` |
| Health responde `DOWN` | Postgres ainda subindo ou credenciais divergentes | `docker compose -f infra/docker-compose.yml ps` e confira as variáveis |
| App abre no Expo Go e quebra | WatermelonDB exige módulo nativo | Instale o dev client com `npm run android` |
| Build Android falha com caminho longo (pasta `.cxx`) | Limite de 260 caracteres do Windows | Ative caminhos longos no Windows (`LongPathsEnabled`) ou clone o projeto num caminho mais curto |
| Mudou dependência nativa e o app não reflete | O dev client instalado é antigo | Rode `npm run android` de novo |

## Zerar o ambiente

```bash
docker compose -f infra/docker-compose.yml down       # para o banco e mantém os dados
docker compose -f infra/docker-compose.yml down -v    # apaga também o volume pgdata (banco do zero)
```
