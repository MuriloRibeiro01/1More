# ADR-002 — Migração para Spring Boot 4.0.x

- **Status:** aceita (PO: Atlas, 2026-10-14). O usuário pode rever.
- **Contexto:** risco R-02 levantado pelo Leônidas. O suporte OSS do Spring Boot 3.5 acabou em 30/06/2026, e a 3.5.16, usada no T-001, é a última release OSS. Sem patches de segurança novos para Spring Security, Spring Framework e Tomcat nessa linha.

## Decisão
- Migrar o backend para **Spring Boot 4.0.x** (última patch estável) na tarefa **T-001b**, antes do T-002 (autenticação). Assim o JWT não é montado sobre uma linha sem suporte.
- O Java continua na versão 17, que é a baseline do Boot 4 e o JDK instalado.
- O merge do T-001 acontece na 3.5.16, como está. A migração vem logo depois, numa branch própria.

## Alternativas descartadas
- **Suporte comercial da 3.5:** custo recorrente para um projeto que ainda não tem código de negócio. Migrar agora é barato.
- **Ficar na 3.5:** bloqueia qualquer deploy público.

## Consequências
- Revisar as mudanças incompatíveis do Boot 4 / Spring Framework 7 / Spring Security 7, as versões de Flyway, Testcontainers e Jackson, e as propriedades renomeadas.
- `./mvnw test` precisa continuar verde. Revisão do Leônidas e do Sérgio, commit do Homero.
