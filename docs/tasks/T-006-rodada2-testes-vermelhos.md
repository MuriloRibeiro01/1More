# T-006c e T-006b (itens 1 e 3) — testes vermelhos da rodada 2 (Dumont → Prisma)

Rode só os arquivos novos: `npx jest __tests__/t006c __tests__/t006b`. Todo vermelho falha por funcionalidade ausente. `tsc` limpo.
Os nomes de botões e rótulos abaixo são **contrato proposto**: se o Prisma preferir outro, combine e eu ajusto o teste (não o contrário).

## Migrações (numeração combinada: v5 = T-006c, v6 = T-006b)
| Arquivo | Regra |
|---|---|
| `t006c/migracaoV5.test.ts` | passo `toVersion 5` só faz `add_columns` em `exercise` com `is_custom` (boolean). Marca o exercício criado pela pessoa; as linhas do catálogo valem false. Schema atual com a coluna |
| `t006b/migracaoV6.test.ts` | passo `toVersion 6`: `create_table routine_folder` (`name`, `sort_order`, colunas de sync) e `add_columns` em `routine` com `folder_id` (string, opcional, indexada). Schema atual igual. Migrações 2 a 4 intocadas |
Relaxei `fase8/migracaoV4` para `schema.version >= 4` (a v5/v6 vão subir a versão).

## T-006c — catálogo
| Arquivo | Cobre | Regra |
|---|---|---|
| `t006c/filtros.test.tsx` | C22 | Seletor (treino e editor de rotina): linha de músculos com botões `Todos` + um por músculo do catálogo (nomes de `progress.muscles`) e linha de equipamentos `Qualquer equipamento`, `Barra`, `Halteres`, `Polia`, `Máquina`, `Peso corporal`; ativo fica `selected`; músculo e equipamento e busca combinam (E); busca sem acento; marcados sobrevivem à troca de filtro; alvo ≥ 48 dp |
| `t006c/exercicioProprio.test.tsx` | C23 | Botão `Criar exercício próprio` abre formulário (`testID="exercicio-form"`, header `Novo exercício`/`Editar exercício`, campo `Nome do exercício`, botões de escolha única de músculo, equipamento e tipo (`Carga e repetições`=weight_reps, `Só repetições`=bodyweight_reps, `Tempo`=duration), `Salvar exercício`). Grava `exercise` com `is_custom=true`, `user_id` nulo e colunas de sync; nome vazio/repetido (sem maiúsculas/acentos, contra catálogo e próprios) recusa com `alert`; usável em treino e rotina; só o exercício próprio tem `Opções de <nome>` → `Editar exercício` / `Arquivar exercício`; arquivar = `deleted_at`, some do seletor e **treinos antigos mantêm nome e histórico** |
Atenção: `listCatalog` hoje filtra `user_id = null`; o exercício próprio também tem `user_id` nulo no modo local, então a listagem precisa incluí-lo (o teste exige que apareça).

## T-006b — editor de rotina (itens 1 e 3; superset fora)
| Arquivo | Cobre | Regra |
|---|---|---|
| `t006b/letraRotina.test.tsx` | C34 | Editor mostra elemento com `accessibilityLabel="Letra da rotina X"` (texto X) na margem do nome. Rotina existente: a mesma letra da lista (posição entre as ativas); nova: próxima letra livre (`D` com 3, `A` sem nenhuma) |
| `t006b/pastas.test.tsx` | C37 | Treinar em "Editar rotinas": `Nova pasta` → campo `Nome da pasta` + `Criar pasta`; cada pasta é um `header` com `Opções da pasta <nome>` → `Renomear pasta` (`Salvar pasta`) e `Excluir pasta` (confirma com `Excluir`, `Cancelar` mantém); editor: botão `Pasta: <nome ou Sem pasta>` → escolhe a pasta (ou `Sem pasta`) e vale ao `Salvar`; nome vazio/repetido recusa com `alert`; excluir pasta = tombstone, **rotinas ficam vivas, sem pasta, e na lista**; mover não muda nome/exercícios/ordem |

## Status (Dumont, pausado por ordem do Atlas — limite de uso)
- **Pronto:** rodada 1 (`t006e`, `t006a` itens 1 a 3; C13 reescrito pela decisão do PO), rodada 2 (`t006c`, `t006b` itens 1 e 3, migrações v5 e v6), B1 e B2 da T-006e (`t006e/finalizarFimDoTreino`, `aberturaSemBloqueio`, `expurgo` com preferências). Suíte completa: 653 testes, 600 verdes; os 51 vermelhos são só a rodada 2 (t006c e t006b). `tsc` limpo.
- **Rodada 3 em andamento (T-006a itens 4 e 5):** `t006a/notificacaoDescanso.test.tsx` escrito (14 testes, 9 vermelhos por funcionalidade ausente, 5 verdes por serem "não faz nada"). Módulos mockados com `virtual: true`; só rodei esse arquivo. **Falta:** `t006a/telaLigada.test.tsx` (keep-awake ativo só com treino ativo, liberado ao finalizar, descartar e desmontar) e `t006a/semPushToken.test.ts` (varredura: nada em `src/` chama `getExpoPushTokenAsync`/`getDevicePushTokenAsync`; sem `google-services.json`). Depois: avisar o Prisma por `maestri ask` e rodar a suíte completa uma vez.
- **Pendências de aviso:** Prisma ainda não recebeu a rodada 3; o aviso ao Atlas da rodada 3 também.
- Nada commitado (só o Homero). `docs/tasks/T-006-matriz-aceite.md` ainda mostra o C13 como lacuna (agora implementado) e C43 idem; atualizar na próxima oportunidade.

## Rodada 3 — T-006a itens 4 e 5 (Dumont → Prisma), concluída
`npx jest __tests__/t006a/notificacaoDescanso __tests__/t006a/telaLigada __tests__/t006a/semPushToken`: 26 testes, 15 vermelhos (funcionalidade ausente), 11 verdes (guardas). `tsc` e ESLint limpos. Os dois módulos são mockados com `virtual: true` (ainda não instalados).
| Arquivo | Regra que o vermelho espera |
|---|---|
| `t006a/notificacaoDescanso.test.tsx` | `expo-notifications`: concluir série com descanso chama `scheduleNotificationAsync` UMA vez, disparo = fim do descanso (gatilho de data ou de segundos, ±1,5 s), `content.title = 'Descanso acabou'` sem exercício/carga/nome do treino; nova conclusão com descanso correndo cancela a anterior (`cancelScheduledNotificationAsync(id)`) e agenda outra; `Pular` cancela; `+15 s` cancela e reagenda 15 s depois; finalizar e descartar o treino cancelam a pendente; desmarcar não agenda. Permissão: `getPermissionsAsync` primeiro; `undetermined` → `requestPermissionsAsync` **uma única vez** na sessão; negada ou falha do módulo (agendar/cancelar lançando) **nunca** bloqueia: série gravada, timer na tela segue, sem alerta de erro |
| `t006a/telaLigada.test.tsx` | `expo-keep-awake` (rastreador serve para `useKeepAwake`, `activateKeepAwake(Async)`/`deactivateKeepAwake`): ligado com `ActiveWorkout` aberto; desligado na Home, no treino passado (`WorkoutDetail`), ao finalizar (vai ao resumo), ao descartar, ao desmontar e ao minimizar (treino segue ativo, mas a tela do treino sai); sem chamada de rede |
| `t006a/semPushToken.test.ts` | Varredura no `src/`: nenhum `getExpoPushTokenAsync`/`getDevicePushTokenAsync`/`addPushTokenListener`; sem `google-services.json` nem referência em `app.json`; o texto "Descanso acabou" existe no `i18n/locales/pt-BR.ts` **sem interpolação** (vermelho até a chave existir). Os 3 primeiros passam hoje e quebram se alguém introduzir push |
Decisão que precisa de resposta do Atlas: **minimizar** libera a tela? (o teste assume que sim: a tela do treino não está aberta). Se o PO quiser a tela ligada com treino ativo mesmo minimizado, é uma linha para inverter.
