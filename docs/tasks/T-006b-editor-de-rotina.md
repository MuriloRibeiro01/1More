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
- PAUSADA (Prisma, 2026-11-26). Só o banco da v6 está pronto (ver T-006c). Falta: letra da rotina no editor (item 1) e pastas (item 3: telas, repositório, mover/excluir). `t006b/letraRotina` e `t006b/pastas` vermelhos.
- Itens 1 e 3 implementados (Prisma, 2026-11-27), sem commit; item 2 (superset) segue aberto/decisão do PO. `t006b` verdes. Banco: v6 (`routine_folder` + `routine.folder_id`), `routines/folders.ts` (criar/renomear/excluir; excluir = tombstone e as rotinas ficam sem pasta). UI: letra da rotina na margem do editor (mesma da lista; nova = próxima livre), botão `Pasta: …` com folha de escolha, pastas na aba Treinar em 'Editar rotinas' (cabeçalho, opções, nova pasta). `loadRoutine` só devolve `folderId` quando há pasta (compatível com os testes da T-005).
- Code review (Sérgio) — 2026-11-27: **PAUSADO por ordem do Atlas (limite de uso), revisão NÃO iniciada.** Pronto: nada deste escopo revisado. Falta: revisar o working tree desta tarefa (migrações v5/v6, RN-19, exclusão lógica de pasta e de exercício próprio, R-13, RNF-02, acessibilidade/48 dp, theme/fontWeight, pt-BR e en) e responder ao Atlas com bloqueantes e sugestões. Retomo quando o Atlas mandar. Revisões anteriores (T-006, T-006e, T-006a itens 1-3) seguem registradas nos respectivos Status.
- Code review (Sérgio) — 2026-11-27, itens 1 e 3: t006b 100% verdes junto com t006c (52/52, rodados por mim). **Sem bloqueantes.** Migração v6 (`routine_folder` + `routine.folder_id` indexado, nessa ordem) congelada e testada, colunas de sync, UUID v7, `deleted_at`; `deleteFolder` faz tombstone da pasta e põe `folder_id` nulo nas rotinas em UMA transação, sem apagar rotina (teste `pastas`); `routineFolderIds` trata pasta excluída como "sem pasta", o que protege também contra exclusão concorrente no sync. **R-13 intacto:** `saveRoutine` só acrescentou `folder_id` (não mexe nele quando `folderId` é `undefined`), o reaproveitamento de `routine_exercise` segue por id. Letra da rotina na margem coerente com a lista (teste). Sem `fontWeight`/hex; alvos de pasta ≥ 48 dp com teste. **Sugestões:** (s1) `deleteFolder` atualiza também rotinas já tombstonadas (`folders.ts`, consulta sem `active`): inofensivo, mas gera `updated_at` falso para sync; filtrar; (s2) `MAX_FOLDER_NAME` existe e não é aplicado em `createFolder`/`renameFolder`; (s3) `void saveFolder()` e `void removeFolder()` na `RoutineListScreen` não têm tratamento visível de erro; (s4) mover rotina de pasta atualiza a rotina por `saveRoutine` inteiro; ok hoje, mas um `moveRoutine(id, folderId)` evitaria reescrever exercícios e séries a cada troca de pasta.
