# T-006d — Atividades fora da musculação no histórico

**Continuação da T-006** (critério C29 do `T-006-frontend-caderno.md`).
**Responsáveis:** Atlas (decisão de produto) → Dumont (testes primeiro) → Prisma → Leônidas (se houver dado novo sensível) → Sérgio → Sócrates → Homero.
**Fora:** backend, sync e integrações de saúde (Fase 3).
**Requisitos:** RF-47, RF-41, RN-07, RN-24.
**Referências:** `docs/1More-Prototipo-caderno.txt`, seção "HISTORICO.DC.HTML".

## História
Como pessoa que mistura musculação com corrida ou luta, quero registrar essas atividades e vê-las na mesma lista do histórico.

## Escopo
Hoje `workout_set` só guarda carga e reps. A tarefa precisa de uma migração (v4 em diante, conforme a ordem das outras tarefas) com duração e, opcionalmente, distância, e de um fluxo de registro simples ("+ Registrar atividade"). **Decisão aberta do usuário (11):** entra no MVP ou depois. A recomendação do Atlas é depois.

## Critérios de aceite (rascunho, a fechar após a decisão)
- [ ] Registrar uma corrida de 30 min e 5 km: aparece no histórico na mesma lista, com a data na margem.
- [ ] A atividade não conta para volume nem para PR de musculação.
- [ ] Editar e excluir seguem as mesmas regras do treino (RN-11, RN-20).
- [ ] Migração congelada com teste, `deleted_at`, colunas de sync; modo avião; temas Papel e Noite.

## Status
- Aberta — 2026-11-26. **Bloqueada pela decisão 11.**
