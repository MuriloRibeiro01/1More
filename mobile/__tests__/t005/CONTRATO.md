# T-005 — Contrato dos testes de aceite (Dumont → Prisma)

Testes: `__tests__/t005/*.test.ts(x)`. Rodar: `npx jest __tests__/t005`.
Banco nos testes: WatermelonDB + `LokiJSAdapter` em memória (`test-utils/db.ts`), com `schema`,
`migrations` e `modelClasses` do app. Nada nativo.

## Módulos (stubs criados pelo Dumont; o Prisma é dono e pode ajustar avisando)
- `src/db/models/index.ts` → `modelClasses` (classes dos models das 4 tabelas).
- `src/routines/types.ts` → `RoutineDraft`, `ExerciseDraft`, `RoutineSummary`, `CatalogExercise`, `RoutineError`.
- `src/routines/rules.ts` → constantes (`DEFAULT_SETS=3`, `MIN_SETS=1`, `MAX_SETS=10`, `DEFAULT_REST_S=90`,
  `REST_STEP_S=15`, `MAX_REST_S=600`, `MAX_NAME=80`), `parseKg`, `formatRest`, `validateRoutine`,
  `normalizeSearch`, `searchExercises`.
- `src/routines/repository.ts` → `seedCatalog`, `listCatalog`, `saveRoutine` (uma única transação;
  lança `RoutineValidationError` com `.errors`), `loadRoutine`, `listRoutines`, `deleteRoutine` (tombstone).

## Banco (schema v2, colunas snake_case)
- `exercise`: `name`, `user_id` (null = catálogo), `created_at`, `updated_at`, `deleted_at`.
- `routine`: `name`, `user_id` (null no modo local), `created_at`, `updated_at`, `deleted_at`.
- `routine_exercise`: `routine_id`, `exercise_id`, `sort_order`, `rest_seconds`, + colunas de sync.
- `routine_set`: `routine_exercise_id`, `sort_order`, `reps_min`, `reps_max`, `target_weight_kg`, + colunas de sync.
- Ids UUID v7 em todas as tabelas. Exclusão sempre por `deleted_at` (nunca `markAsDeleted`/`destroy`).

## Telas (o que os testes procuram)
Aba Treinar:
- `testID="rotinas-vazio"` quando não há rotinas; botão "Nova rotina" sempre presente; sem botão "Começar".
- Cada rotina: botão cujo nome acessível contém o nome da rotina; nomes dos exercícios visíveis.
Editar rotina:
- Campo com `accessibilityLabel="Nome da rotina"`; botões "Adicionar exercício", "Salvar", "Excluir rotina"
  (só em rotina existente) e IconButton "Fechar".
- Cada exercício num container `testID="exercicio-<índice 0-based>"`, com:
  - botão-cabeçalho com o nome do exercício; se o editor é acordeão, `accessibilityState.expanded`;
  - Stepper `accessibilityRole="adjustable"` `accessibilityLabel="Séries"` com `accessibilityValue.text` ("3"),
    botões "Diminuir séries"/"Aumentar séries";
  - Stepper "Descanso" igual (valor "1:30"), botões "Diminuir descanso"/"Aumentar descanso";
  - campos "Carga alvo (kg)", "Repetições mínimas", "Repetições máximas";
  - botões "Remover exercício", "Mover para cima", "Mover para baixo".
- Erro de validação: elemento `accessibilityRole="alert"` com o motivo (contém "nome", "exercício" ou "carga").
- Fechar com mudanças → Sheet com botão "Descartar". Excluir rotina → Sheet com botão "Excluir".
Adicionar exercício:
- Campo `accessibilityLabel="Buscar exercício"`; cada item `accessibilityRole="checkbox"` com o nome do
  exercício e `accessibilityState.checked`; botão "Adicionar 1 exercício" / "Adicionar N exercícios".
Alvos ≥ 48dp em todo `button`/`checkbox` dessas telas.
