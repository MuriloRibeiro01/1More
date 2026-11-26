# T-006c — Catálogo: filtros e exercício próprio

**Continuação da T-006** (critérios C22 e C23 do `T-006-frontend-caderno.md`). O tamanho do catálogo (C24) fica na **T-004**.
**Responsáveis:** Dumont (testes primeiro) → Prisma → Sérgio → Sócrates → Homero.
**Fora:** backend, sync e mídia (imagens e GIFs, RF-14).
**Requisitos:** RF-11, RF-12, RF-13, RN-19.
**Referências:** `docs/1More-Prototipo-caderno.txt`, seção "CATALOGO.DC.HTML".

## História
Como pessoa que treina, quero filtrar o catálogo por músculo e equipamento e criar um exercício que não existe nele.

## Escopo
1. **Filtros escritos (C22):** "Todos · Peito · Costas…" como texto, com o sublinhado marcando o ativo; combinam com a busca por nome sem acento.
2. **Criar exercício próprio (C23, RF-12):** "+ Criar exercício próprio" abre um formulário (nome, músculo, equipamento, tipo de registro do RF-13). Editar e arquivar só o que é do usuário; o do catálogo nunca é editado, só ocultado (RN-19).

## Critérios de aceite (o Dumont transforma em testes ANTES do código)
- [ ] Filtrar por "Peito" mostra só exercícios de peito; "Todos" mostra tudo; a busca "sup" continua achando "Supino" dentro do filtro.
- [ ] Criar "Remada na polia" com músculo e equipamento: aparece no catálogo e pode ser adicionado a rotina e a treino.
- [ ] Nome vazio ou repetido é recusado com o motivo.
- [ ] Arquivar exercício próprio some do seletor mas mantém o histórico dos treinos antigos.
- [ ] Exercício do catálogo não tem opção de editar.
- [ ] Gravação em transação, `deleted_at` em vez de DELETE, colunas de sync; modo avião; alvos ≥ 48 dp; temas Papel e Noite.

## Status
- Aberta — 2026-11-26. Sem decisão pendente para o formulário; o tamanho e o conteúdo do catálogo dependem da decisão 4 (base própria em texto) e seguem na T-004.
