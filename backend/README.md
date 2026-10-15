# 1more — backend

Spring Boot 3.5 / Java 17 / Maven wrapper. Pacote base `com.onemore`.

## Rodar local
```bash
docker compose -f infra/docker-compose.yml up -d   # PostgreSQL 16 na porta 5433 do host (POSTGRES_PORT)
cd backend && ./mvnw spring-boot:run               # API em http://localhost:8080 (perfil dev)
curl http://localhost:8080/actuator/health         # {"status":"UP",...}
```
A porta padrão do host é **5433** para não colidir com um PostgreSQL nativo na 5432.

## Testes
```bash
cd backend && ./mvnw test   # precisa do Docker rodando (Testcontainers sobe postgres:16-alpine)
```

## Configuração
| Variável | Uso | Default |
|----------|-----|---------|
| `SPRING_DATASOURCE_URL` | JDBC do Postgres | só no perfil dev: `jdbc:postgresql://localhost:5433/onemore` |
| `SPRING_DATASOURCE_USERNAME` | usuário | só no perfil dev: `onemore` |
| `SPRING_DATASOURCE_PASSWORD` | senha | só no perfil dev: `onemore_dev` |

O perfil `dev` é ativado apenas por `./mvnw spring-boot:run` (configurado no `pom.xml`).
Fora dele (jar empacotado) as três variáveis são obrigatórias e o health não expõe detalhes.

## Segurança (fase T-001)
- Público: `GET /actuator/health` (e `/actuator/health/liveness|readiness`).
- Todo o resto: **401** até a T-002 (JWT). API stateless, sem sessão/CSRF/form login/Basic.

## Banco — convenções (V1)
- Migrações só via Flyway em `src/main/resources/db/migration`. Nunca altere uma migração já mergeada.
- Toda tabela sincronizável: `id uuid` (v7 do cliente), `user_id`, `created_at`, `updated_at`
  (relógio do cliente, `timestamptz`), `server_version bigint`, `deleted_at` (tombstone).
- `server_version` vem da sequência global `server_version_seq` e é **sempre** atribuída por trigger
  (`set_server_version`) em todo INSERT/UPDATE — qualquer valor enviado pelo cliente é ignorado.
  Tombstone (`deleted_at`) também gera versão nova, para o pull entregar a exclusão.
- Índice `(user_id, server_version)` em cada tabela sincronizável, para o pull.
- `sync_push_log (user_id, client_op_id)` garante idempotência do push e guarda a `server_version`
  devolvida na primeira aplicação.

### Tabelas da V1 e valores aceitos (contrato com o app)
| Tabela | Campos | Domínios |
|--------|--------|----------|
| `app_user` | `email`, `nome`, `unidade`, `meta_dias_semana`, `fuso`, `consentimentos` | `unidade` ∈ `kg`,`lb`; `meta_dias_semana` 1–7; `fuso` IANA (ex.: `America/Sao_Paulo`); `consentimentos` objeto JSON por finalidade; e-mail único (sem diferenciar caixa) entre contas ativas |
| `user_settings` | `incremento_kg`, `anilhas`, `tema`, `gamificacao_ativa`, `inicio_semana` | 1 por usuário; `incremento_kg` > 0, 2 casas; `anilhas` array JSON (`[{"kg":20.00,"qtd":2}]`); `tema` ∈ `sistema`,`papel`,`noite`; `inicio_semana` ISO 1 (seg) – 7 (dom) |

`app_user` não tem `user_id` (o próprio `id` é o usuário) e vive só no servidor; o app guarda cache do perfil.
