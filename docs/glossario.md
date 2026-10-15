# Glossário

Termos do domínio (treino) e da arquitetura do 1more, em ordem alfabética. Onde houver, o ID do requisito
ou o arquivo de referência aparece entre parênteses.

| Termo | Significado |
|-------|-------------|
| **1RM estimado** | Carga máxima teórica para 1 repetição, pela fórmula de Epley: `w × (1 + r/30)`, só para séries de 1 a 12 reps (RN-10). |
| **Anilhas** | Pesos disponíveis do usuário, em kg, usados pela calculadora de anilhas. Em `user_settings.anilhas`, ex.: `[{"kg":20.00,"qtd":2}]` (RF-71). |
| **`client_op_id`** | UUID gerado pelo app para cada lote de push. O servidor grava o par `(user_id, client_op_id)` em `sync_push_log` e, num reenvio, ignora o lote e devolve a mesma `server_version` da primeira vez. É o que torna o push idempotente (RNF-06). |
| **Congelamento** | Proteção do streak: a cada 4 semanas cumpridas o usuário ganha 1 (máx. 2), aplicado automaticamente numa semana não cumprida (RN-15). |
| **Dev client** | Build própria do app com os módulos nativos (WatermelonDB etc.). Substitui o Expo Go, que não roda o 1more. Instalada com `npm run android`. |
| **Expurgo** | Remoção física de um registro em tombstone, depois de 30 dias (RN-20). |
| **Fase 0** | Fundação do roadmap: schema, autenticação, sync, catálogo, testes de modo avião (T-001 a T-004). |
| **Flyway** | Ferramenta de migração do PostgreSQL. Arquivos `V<n>__descricao.sql` em `backend/src/main/resources/db/migration`; migração mergeada nunca é alterada. |
| **Garagem 69** | Direção visual do Design System: caderno de treino com cores de muscle car (Hugger, Grabber, faixa amarela). |
| **Grabber / Hugger / Stripe** | Tokens de cor. `grabber` (azul): série concluída, link, foco. `hugger` (laranja): recorde, ação destrutiva, timer estourado. `stripe` (amarelo): treino em andamento, dia de hoje. |
| **Idempotência** | Reenviar a mesma operação não muda o resultado nem duplica dados. No push, garantida pelo `client_op_id`. |
| **Last-write-wins (LWW)** | Regra de conflito: vale a última escrita, ordenada pela versão do servidor. Usada para rotinas, exercícios e perfil (RN-21). |
| **Lápis e caneta** | Princípio visual: o que o app sugere aparece em `inkMuted` (lápis); o que o usuário confirma, em `ink` (caneta). |
| **Modo local** | Usar o app sem conta; os dados ficam no SQLite e podem ser vinculados a uma conta depois (RF-02). |
| **Noite / Papel** | Os dois temas. Papel = claro (padrão); Noite = escuro. No código: `light` e `dark`; no banco: `papel` e `noite` (`sistema` segue o aparelho) (RF-72). |
| **Offline-first** | O app funciona por completo sem rede: grava e lê só no banco local, e o sync replica depois. Offline é estado normal, não erro (RN-01, RNF-01). |
| **Perfil `dev`** | Perfil do Spring Boot ativado só por `./mvnw spring-boot:run`: dá defaults de conexão para o Postgres local e mostra detalhes do health. |
| **PR (recorde pessoal)** | Maior carga, maior 1RM estimado, maior volume numa série ou mais reps numa mesma carga, por exercício (RN-11). Só séries válidas contam. |
| **Progressão dupla** | Sugestão de carga: se todas as séries atingiram o topo da faixa de reps, sugere + incremento; se ficaram abaixo do mínimo 2 sessões seguidas, sugere manter ou reduzir 10%. Sempre sugestão (RN-12). |
| **Pull** | Etapa do sync em que o app pede ao servidor tudo com `server_version` maior que a última recebida, incluindo tombstones. ⬜ T-003. |
| **Push** | Etapa do sync em que o app envia os registros criados, alterados e excluídos, por tabela, com um `client_op_id`. ⬜ T-003. |
| **RF / RNF / RN** | Requisito funcional / não funcional / regra de negócio, numerados em `docs/requisitos.txt`. |
| **RPE / RIR** | Esforço percebido (escala de 1 a 10) / repetições em reserva. Registráveis por série (RF-36). |
| **`server_version`** | Número de versão de cada linha, atribuído **só pelo servidor** a partir da sequência global `server_version_seq`, por um trigger em todo INSERT/UPDATE (inclusive tombstone). O pull usa esse número para saber o que o app ainda não tem. Ver risco R-01 no BACKLOG. |
| **`server_version_seq`** | Sequência global do PostgreSQL compartilhada por todas as tabelas sincronizáveis (`V1__baseline.sql:13`). |
| **Série válida** | Série concluída e que não é de aquecimento. Só ela conta para volume, PR, XP e gráficos (RN-08). |
| **Sheet** | Folha que sobe de baixo para escolhas e confirmações. O app nunca usa diálogo central. |
| **Streak semanal** | Sequência de semanas em que o usuário bateu a meta de dias de treino. Faltar num dia nunca zera o streak (RN-14). |
| **Sync (motor de)** | Módulo do app (`mobile/src/sync`) que replica o banco local com o servidor em segundo plano. É o único que fala com a rede. ⬜ T-003. |
| **`sync_push_log`** | Tabela do servidor com `(user_id, client_op_id, server_version, processed_at)`. Registra cada push já aplicado, para ignorar reenvios (`V1__baseline.sql:97`). |
| **Tabela sincronizável** | Tabela que existe no app e no servidor e tem as colunas `id`, `user_id`, `created_at`, `updated_at`, `server_version`, `deleted_at`. `app_user` é exceção: não tem `user_id`. |
| **Testcontainers** | Biblioteca que sobe um PostgreSQL descartável em Docker durante `./mvnw test`. |
| **Tombstone** | Marca de exclusão lógica: preencher `deleted_at` em vez de apagar a linha. O tombstone recebe nova `server_version` e é entregue no pull, para que todos os aparelhos saibam da exclusão. Expurgado após 30 dias (RN-20). |
| **Treino ativo** | Treino iniciado e ainda não finalizado. Só um por aparelho (RN-02); sobrevive a crash e reinício (RF-34). |
| **Treino retroativo** | Treino registrado com data/hora passada; nunca futura (RF-42, RN-07). |
| **UUID v7** | Identificador gerado no app, ordenável por tempo. Nenhuma gravação depende de o servidor devolver um id. |
| **Volume** | Soma de carga × reps das séries válidas (RN-09). |
| **WatermelonDB** | Banco local do app, sobre SQLite, com protocolo de sync pull/push (ADR-001). |
| **XP** | Pontos derivados dos dados (não acumulados): 10 por treino, 1 por série válida, 25 por PR, teto de 150 por dia (RN-16). |
