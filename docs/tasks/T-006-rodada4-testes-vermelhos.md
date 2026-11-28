# T-006c e T-006a — testes vermelhos das decisões do PO (rodada 4, Dumont → Prisma)

Rode só os arquivos novos. `tsc` limpo, ESLint sem erros. Sem produção, sem commit.

| Arquivo | Origem | Regra que o vermelho espera |
|---|---|---|
| `t006c/arquivarEmRotina.test.tsx` | T-006c **B1** | `saveRoutine` aceita o exercício arquivado que JÁ está na rotina (renomear, mudar de pasta, ajustar séries, tirar da rotina); rotina nova ou rotina que não o tinha continua recusando; o seletor não o oferece; um treino novo da rotina inclui o exercício; o editor mostra o nome do arquivado e salva sem erro. Hoje `routines/repository.ts:84` só aceita exercício ativo |
| `t006a/minimizarDescanso.test.tsx` | T-006a (a) | Timer e notifier no nível do `RootNavigator`: minimizar no descanso NÃO cancela a notificação nem o timer (`schedule` 1x, `cancel` 0x); ao voltar pela faixa Retomar o descanso mostra o restante (1:30 − 30 s = 1:00; duas idas e voltas = 1:10, sem reagendar); zerar minimizado vibra uma vez e mostra 0:00; `Pular`, `+15 s`, finalizar e descartar continuam cancelando/reagendando (os dois últimos já passam) |
| `t006a/trocarSessaoAnterior.test.ts` | T-006a (b) | Decisão do PO (28/11): cada pendente movida pega a MESMA POSIÇÃO da sessão anterior do exercício NOVO (1ª com a 1ª, 2ª com a 2ª); passou do fim, repete a ÚLTIMA; sem sessão anterior, campos vazios; nunca os valores do antigo. A posição conta entre as pendentes movidas (concluídas ficam no antigo) |
| `t006a/trocarFalha.test.tsx` | T-006a (d) | Troca que lança: aparece `alert`, não volta como se tivesse dado certo, o treino fica como estava e continua usável. O teste mocka `swapExercise` para rejeitar |
| `t006a/swapValidacao.test.ts` | T-006a (a) Sérgio | `swapExercise` recusa o mesmo exercício e treino finalizado, sem gravar (os recusos de id inexistente já passam) |
| `t006a/contraste.test.ts` | T-006a (e) | `contrastRatio` com valores conhecidos (21:1, 1:1, 12,08/5,07 Papel, 10,34/5,54 Noite); formatos `#fff`, `rgb(...)`, nome e vazio: entende ou lança, **nunca NaN em silêncio** (hoje devolve NaN) |
| `t006a/contrasteRamo.test.tsx` | T-006a (e) | Com contraste forçado a 3:1 os valores da série da vez passam para tinta e as demais pendentes seguem a lápis, nos dois temas (já passa: o ramo existe e agora tem teste) |
| `t006c/formularioAjustes.test.tsx` | s1, s2, s3 | s1: formulário sem "Só repetições"/"Tempo", grava `weight_reps`; s2: músculo e equipamento desmarcam ao tocar de novo e vão a `null`; s3: cada opção com `minWidth` ≥ 48 |
| `t006c/falhaArquivar.test.tsx` | s4 | Arquivar que lança mostra `alert`, mantém o exercício na lista e sem `deleted_at` (mocka `archiveCustomExercise`) |
| `t006c/exercicioNome.test.ts` | s7 | `saveCustomExercise` limita o nome a 80 caracteres (recusa 81, aceita 80, ignora espaços das pontas), também ao editar |

Ajustes em testes meus anteriores: `t006c/exercicioProprio` não exige mais "Só repetições"/"Tempo" (s1) e o teste de tipo gravado virou `weight_reps`.
Sugestões s5 e s6 do Sérgio (gráfico de Progresso com exercício arquivado; `user_id` com conta) ficaram sem teste: s5 não foi pedida e s6 é para a T-003/T-004.
