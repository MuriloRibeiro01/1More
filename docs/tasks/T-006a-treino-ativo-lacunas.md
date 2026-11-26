# T-006a — Treino ativo: fechar as lacunas do protótipo

**Continuação da T-006** (critérios C13, C16 a C20 do `T-006-frontend-caderno.md`).
**Responsáveis:** Dumont (testes de aceite primeiro, TDD) → Prisma (mobile) → Leônidas (dependências novas) → Sérgio → Sócrates → Homero.
**Fora:** backend e sync. Tudo local.
**Requisitos:** RF-31 a RF-35, RF-15, RN-23, RNF-09.
**Referências:** `docs/1More-Prototipo-caderno.txt`, seção "TREINO.DC.HTML".

## História
Como pessoa que treina, quero que o treino ativo me mostre qual é a série da vez, me deixe trocar um exercício e consultar o histórico dele sem sair do treino, e me avise do fim do descanso mesmo com o app em segundo plano.

## Escopo
1. **Série da vez (C13):** a primeira série não concluída do exercício ganha a faixa amarela (`FaixaDestaque`, `stripeWash`), com o texto em tinta. Hoje o `ActiveWorkoutScreen` não usa `Linha` com `destaque`.
2. **Trocar exercício (C16):** opção na folha `···`. Abre o seletor de exercícios com seleção única; as séries já concluídas são mantidas, as pendentes passam para o novo exercício.
3. **Ver histórico e recordes (C17):** opção na folha `···` que abre a tela Exercício (seção Histórico e Recordes) e volta ao treino sem perder nada.
4. **Notificação local do descanso (C18):** avisa o fim do descanso com o app fechado ou em segundo plano. Exige `expo-notifications`: **dependência nova, revisão do Leônidas e novo dev client.**
5. **Tela ligada durante o treino (C19):** `expo-keep-awake`, só com treino ativo. Mesma exigência de revisão e de dev client.

## Fora do escopo
Seletor do tipo de série A, D, F (C20): o protótipo não tem tela e a decisão está aberta no resumo do Atlas. Entra aqui só se o usuário decidir que entra no MVP.

## Critérios de aceite (o Dumont transforma em testes ANTES do código)
- [ ] Com 2 séries pendentes, só a primeira tem a faixa amarela; ao concluí-la, a faixa passa para a seguinte; sem pendentes, nenhuma faixa.
- [ ] Trocar exercício mantém as séries concluídas e move as pendentes; o volume do treino não muda.
- [ ] "Ver histórico e recordes" abre o Exercício e o voltar devolve o treino exatamente como estava (valores digitados e descanso em andamento).
- [ ] Concluir uma série com descanso agenda uma notificação local para o horário de término; pular ou finalizar o treino a cancela.
- [ ] A tela fica ligada com treino ativo e volta ao normal ao finalizar ou descartar.
- [ ] Tudo funciona em modo avião; alvos ≥ 48 dp; temas Papel e Noite; sem hex fora do `theme.ts`.
- [ ] Piloto manual: Dumont percorre o fluxo no emulador e anexa o resultado no Status.

## Status
- Aberta — 2026-11-26. Itens 1 a 3 não dependem de decisão e podem começar; os itens 4 e 5 dependem da revisão de dependências do Leônidas e de um novo build.
