# T-005 — Planilha de treino (rotinas), piloto local

**Fase 2, feature 1.** Método: uma feature por vez, ponta a ponta, testada, antes da próxima.
**Responsáveis:** Dumont (testes de aceite primeiro, TDD) → Prisma (mobile) → Leônidas (só se entrar dependência nova) → Sérgio → Sócrates (CHANGELOG) → Homero.
**Fora:** Tesla, backend e sync. A feature é 100% local (modo sem conta, RF-02).
**Requisitos:** RF-20 (parcial), RF-21, RF-10 (parcial), RN-13, RN-19, RNF-01, RNF-02, RNF-09.
**Referências (só estes trechos):** Protótipo `docs/1More-Prototipo-MVP.txt`, seções "ROTINA.DC.HTML" e "CATALOGO.DC.HTML". Props de Stepper, NumberField, TextField, RoutineCard, SectionHeader, EmptyState e Sheet no `docs/1More-Design-System.txt` (grep pelo nome). Modelo de dados: tabelas `exercise`, `routine`, `routine_exercise` e `routine_set` da nota "untitled" no canvas, com os ajustes C e D da nota "Fase 2 — Briefing".

## História
Como pessoa que treina, quero montar e guardar a planilha de um treino (ex.: "Treino A — Peito"). Escolho os exercícios e, para cada um, defino o número de séries, a carga, as repetições e o descanso entre séries. Assim, deixo de anotar no papel.

## Escopo (o que entra)
1. **Catálogo embarcado mínimo:** cerca de 20 exercícios de musculação, semeados no primeiro uso (lista da nota "untitled"). Só leitura (RN-19).
2. **Adicionar exercício:** lista do catálogo com busca por nome que ignora acentos ("sup" acha "Supino"). Seleção múltipla e "Adicionar N exercícios".
3. **Editar rotina:** nome da rotina (obrigatório, 1 a 80 caracteres). Por exercício:
   - **Séries:** Stepper de 1 a 10, padrão 3.
   - **Carga alvo (kg):** NumberField com decimal e vírgula aceita. ≥ 0, 2 casas, guardada em kg (RN-13). Opcional.
   - **Repetições mín/máx:** NumberFields, opcionais, mín ≤ máx. *(Proposta do Atlas, aguardando confirmação do usuário.)*
   - **Descanso:** Stepper de 15 em 15 s, de 0 a 10:00, exibido como `1:30`. **Padrão 1:30 (90 s).**
   - **Ações:** remover exercício; mover para cima/baixo (a alça de arrastar fica para depois).
   - **Salvar** grava tudo numa única transação. **X** descarta, com confirmação em Sheet se houver mudanças.
4. **Aba Treinar:** lista de rotinas salvas (RoutineCard: nome e exercícios) e "Nova rotina". Sem rotinas, mostra EmptyState. Tocar na rotina abre a edição. Excluir rotina é exclusão lógica, com confirmação em Sheet. **Sem o botão "Começar"**, porque o treino ativo é a próxima feature.
5. **Persistência:** WatermelonDB, schema v2 (migração a partir do v1 vazio). Tabelas `exercise`, `routine`, `routine_exercise` e `routine_set`, com colunas em inglês (padrão da nota "untitled"). O número de séries é materializado em N linhas de `routine_set` com a mesma carga e as mesmas reps, o que deixa pronta a edição por série no futuro. Ids em UUID v7 gerados no app. Preparadas para sync: `user_id` nulo no modo local, `created_at`, `updated_at`, `deleted_at`.

## Fora do escopo
Pastas (RF-24), superset (RF-22), tipos de série (RF-23), carga diferente por série, arrastar para reordenar, filtros por músculo, exercício personalizado (RF-12), iniciar treino, sync/backend, conta.

## Critérios de aceite (o Dumont transforma em testes ANTES do código)
- [ ] Crio uma rotina com 2 exercícios, salvo, fecho e reabro o app: tudo continua lá, com os mesmos valores.
- [ ] O exercício entra com 3 séries e descanso 1:30 quando eu não mexo em nada.
- [ ] Carga "82,5" é gravada como 82.50 kg e exibida como "82,5 kg". Carga negativa ou texto inválido não salva.
- [ ] Rotina sem nome ou sem exercício não salva, e a mensagem diz o motivo.
- [ ] 4 séries viram 4 `routine_set`; mudar para 2 deixa só 2 ativas.
- [ ] Busca "agach" encontra "Agachamento livre"; busca sem acento encontra nome com acento.
- [ ] Excluir rotina some da lista e no banco fica com `deleted_at` (sem DELETE físico).
- [ ] Salvar é atômico: falha no meio não deixa rotina pela metade.
- [ ] Funciona em modo avião (não existe nenhuma chamada de rede).
- [ ] Alvos ≥ 48dp, rótulos acessíveis, temas Papel e Noite, sem hex fora do `theme.ts`.
- [ ] Piloto manual: Dumont percorre o fluxo no emulador Android e anexa o resultado no Status.

## Status
- Aberta — 2026-10-18
