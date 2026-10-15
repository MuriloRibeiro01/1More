// Motor de sync (pull/push WatermelonDB ↔ /api/v1/sync/*) — entra em tarefa própria.
// Regra (RN-01/RNF-01): nenhuma tela chama a API; só este módulo fala com a rede, em segundo plano.
export {};
