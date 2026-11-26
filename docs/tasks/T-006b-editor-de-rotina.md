# T-006b — Editor de rotina: letra, superset e pastas

**Continuação da T-006** (critérios C34, C35, C36, C37 do `T-006-frontend-caderno.md`).
**Responsáveis:** Dumont (testes primeiro) → Prisma → Sérgio → Sócrates → Homero. Leônidas só se entrar dependência nova.
**Fora:** backend e sync.
**Requisitos:** RF-20 a RF-24, RN-19.
**Referências:** `docs/1More-Prototipo-caderno.txt`, seção "ROTINA.DC.HTML".

## História
Como pessoa que monta a própria planilha, quero identificar a rotina pela letra, agrupar exercícios em superset e organizar as rotinas em pastas.

## Escopo
1. **Letra da rotina (C34):** letra (A, B, C) na margem do editor, igual à lista de rotinas.
2. **Superset (C35, RF-22, prioridade Must):** "Superset com o próximo" agrupa dois exercícios; a margem vira 3a/3b. Exige coluna nova (migração v5) e que o treino ativo respeite o agrupamento. **Decisão aberta do usuário:** manter ou cortar do primeiro MVP.
3. **Pastas (C37, RF-24, prioridade Should):** a rotina fica numa pasta (ex.: Divisão ABC). Exige tabela ou coluna nova (migração).

## Fora do escopo
Reordenar por arrastar (C36): no protótipo é só visual e a decisão aberta é manter os botões de subir e descer.

## Critérios de aceite (o Dumont transforma em testes ANTES do código)
- [ ] O editor mostra a letra da rotina na margem, a mesma da lista.
- [ ] Marcar "superset com o próximo" liga dois exercícios, a margem mostra 3a e 3b, e desfazer volta ao normal.
- [ ] Remover um exercício de um superset desfaz o par sem corromper a ordem.
- [ ] Iniciar um treino de rotina com superset mantém o agrupamento visível no treino ativo.
- [ ] Criar, renomear e excluir pasta; mover rotina entre pastas; excluir pasta não apaga as rotinas (vão para "sem pasta").
- [ ] Migração congelada com teste, exclusão lógica (`deleted_at`), colunas de sync em toda tabela nova.
- [ ] Modo avião, alvos ≥ 48 dp, temas Papel e Noite.

## Status
- Aberta — 2026-11-26. **Bloqueada pela decisão 7** (superset no MVP?) para o item 2; os itens 1 e 3 podem começar.
