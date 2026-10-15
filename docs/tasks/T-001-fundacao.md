# T-001 — Fase 0: fundação dos projetos

**Responsáveis:** Tesla (backend), Prisma (mobile), Homero (git), Dumont (testes), Leônidas, Sérgio
**Requisitos:** RNF-08, RNF-10, RNF-16, RNF-17, RNF-18, RF-72, ADR-001
**Referências:** `docs/requisitos.txt`, `docs/1More-Design-System.txt`, `docs/1More-Guia-React-Native.txt`, `docs/1More-Prototipo-MVP.txt`

## Escopo
### Backend (Tesla) — `backend/`
- Projeto Spring Boot 3 / Java 17 / Maven wrapper, pacote base `com.onemore`.
- Dependências: Web, Security, Data JPA, Validation, Flyway, Actuator, PostgreSQL, Testcontainers.
- `application.yml` lendo datasource de variáveis de ambiente (ver `.env.example`).
- Migração `V1__baseline.sql` com `app_user`, `user_settings` e `sync_push_log` + sequência global `server_version_seq` (campos conforme "Modelo de dados inicial" em `requisitos.txt`).
- Security mínima nesta fase: `/actuator/health` público, todo o resto autenticado (auth real vem em T-002).
- `GET /actuator/health` respondendo UP com o Postgres do `infra/docker-compose.yml`.
- Teste de integração com Testcontainers subindo o contexto.

### Mobile (Prisma) — `mobile/`
Corresponde ao passo **1 · Fundação** da "Ordem sugerida de implementação" do Guia React Native.
- Projeto Expo + TypeScript, dev client configurado. Estrutura: `src/{screens,components,db,sync,theme,i18n,navigation}`.
- `src/theme/theme.ts` **exatamente** como no Guia RN (colors light/dark, space, radius, border, size, type) + provider de tema Papel/Noite seguindo o sistema, com troca manual.
- Fontes via `@expo-google-fonts/*` com o hook `useOneMoreFonts()` do Guia; splash até carregar.
- Componentes de fundação com os mesmos nomes/props do Design System: `Icon`, `Button`, `IconButton`, `TopBar`, `TabBar`.
- Navegação: 4 abas **Treinar · Histórico · Progresso · Perfil** (nessa ordem) usando o `TabBar` próprio, cada aba com `TopBar` + placeholder (`EmptyState` simples é opcional).
- WatermelonDB instalado e configurado (schema inicial vazio + migrations) — sem telas usando ainda.
- i18n pt-BR (padrão) e en; números formatados em pt-BR.

**Pendência conhecida:** os SVGs de `assets/Icons/`, `tokens.json` e `components/index.d.ts` citados no Design System **não estão no repositório**. Implemente o `Icon` com a API final (`name`, `size`, `strokeWidth`, `title`) e paths provisórios desenhados no estilo (traço 2px, square/miter, grade 24) para os ícones das abas; registre a lacuna no Status.

## Critérios de aceite
- [ ] `docker compose -f infra/docker-compose.yml up -d` + `./mvnw spring-boot:run` → health UP.
- [ ] `./mvnw test` verde.
- [ ] `npx expo start` abre o app com as 4 abas corretas, fontes carregadas e troca Papel/Noite funcionando.
- [ ] Nenhuma cor/hex fora de `theme.ts`; nenhum `fontWeight` com as fontes customizadas; alvos ≥ 48dp.
- [ ] Testes (Dumont), segurança (Leônidas) e review (Sérgio) aprovados; commits por escopo feitos por Homero.

## Status
- Aberta — 2026-10-14
- Reaberta com escopo mobile corrigido após chegada do Design System / Guia RN / Protótipo — 2026-10-14
