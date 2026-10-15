-- V1 — baseline (T-001). Fonte: docs/requisitos.txt, "Modelo de dados inicial" e
-- "Arquitetura offline-first e sincronização". NUNCA altere esta migração depois de mergeada.
--
-- Convenções de toda tabela sincronizável:
--   id             uuid v7 gerado no cliente (o servidor nunca gera id de registro sincronizado)
--   user_id        dono do registro
--   created_at     relógio do cliente (UTC)
--   updated_at     relógio do cliente (UTC)
--   server_version bigint da sequência global, atribuído pelo servidor a cada insert/update
--   deleted_at     tombstone (exclusão sempre lógica — RN-20)

-- Sequência global: o pull pede "tudo com server_version > X" (protocolo WatermelonDB).
CREATE SEQUENCE server_version_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Garante que todo insert/update recebe uma server_version nova, independentemente de quem
-- grava (JPA, SQL manual, job de expurgo). O valor enviado pelo cliente é sempre ignorado.
CREATE FUNCTION set_server_version() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    NEW.server_version := nextval('server_version_seq');
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- app_user — perfil da conta. Só existe no servidor; o app guarda um cache local do perfil.
-- Sem user_id: o próprio id é o usuário. Perfil sincroniza com last-write-wins (RN-21).
-- Credenciais/provedores de login (RF-01) entram na T-002 em migração própria.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE app_user (
    id               uuid         NOT NULL,
    email            varchar(320) NOT NULL,
    nome             varchar(100),
    unidade          varchar(2)   NOT NULL DEFAULT 'kg',
    meta_dias_semana smallint     NOT NULL DEFAULT 3,
    fuso             varchar(64)  NOT NULL DEFAULT 'UTC',
    -- Consentimentos LGPD (RN-25 / RNF-12), por finalidade, ex.:
    -- {"medidas_corporais": {"concedido": true, "em": "2026-10-14T12:00:00Z", "versao_termo": 1}}
    consentimentos   jsonb        NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz  NOT NULL,
    updated_at       timestamptz  NOT NULL,
    server_version   bigint       NOT NULL,
    deleted_at       timestamptz,
    CONSTRAINT pk_app_user PRIMARY KEY (id),
    CONSTRAINT ck_app_user_unidade CHECK (unidade IN ('kg', 'lb')),
    CONSTRAINT ck_app_user_meta_dias CHECK (meta_dias_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_app_user_consentimentos CHECK (jsonb_typeof(consentimentos) = 'object')
);

-- E-mail único sem diferenciar maiúsculas, apenas entre contas ativas: uma conta excluída
-- (tombstone aguardando expurgo de 30 dias) não impede recadastro com o mesmo e-mail.
CREATE UNIQUE INDEX ux_app_user_email_ativo ON app_user (lower(email)) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_app_user_server_version
    BEFORE INSERT OR UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION set_server_version();

-- ---------------------------------------------------------------------------------------------
-- user_settings — um registro por usuário, sincronizável (last-write-wins, RN-21).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE user_settings (
    id                uuid         NOT NULL,
    user_id           uuid         NOT NULL,
    -- Carga sempre em kg com 2 casas (RNF-15); ex.: 1.25, 2.50.
    incremento_kg     numeric(5,2) NOT NULL DEFAULT 2.50,
    -- Anilhas disponíveis em kg, ex.: [{"kg": 20.00, "qtd": 2}, {"kg": 1.25, "qtd": 2}]
    anilhas           jsonb        NOT NULL DEFAULT '[]'::jsonb,
    tema              varchar(10)  NOT NULL DEFAULT 'sistema',
    gamificacao_ativa boolean      NOT NULL DEFAULT true,
    -- Dia ISO-8601 em que a semana começa: 1 = segunda (padrão, RN-24) ... 7 = domingo.
    inicio_semana     smallint     NOT NULL DEFAULT 1,
    created_at        timestamptz  NOT NULL,
    updated_at        timestamptz  NOT NULL,
    server_version    bigint       NOT NULL,
    deleted_at        timestamptz,
    CONSTRAINT pk_user_settings PRIMARY KEY (id),
    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT ux_user_settings_user UNIQUE (user_id),
    CONSTRAINT ck_user_settings_incremento CHECK (incremento_kg > 0),
    CONSTRAINT ck_user_settings_anilhas CHECK (jsonb_typeof(anilhas) = 'array'),
    CONSTRAINT ck_user_settings_tema CHECK (tema IN ('sistema', 'papel', 'noite')),
    CONSTRAINT ck_user_settings_inicio_semana CHECK (inicio_semana BETWEEN 1 AND 7)
);

CREATE INDEX ix_user_settings_pull ON user_settings (user_id, server_version);

CREATE TRIGGER trg_user_settings_server_version
    BEFORE INSERT OR UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION set_server_version();

-- ---------------------------------------------------------------------------------------------
-- sync_push_log — idempotência do /sync/push (RNF-06): um client_op_id já processado é ignorado
-- e o servidor devolve a mesma server_version da primeira aplicação.
-- Chave por (user_id, client_op_id) para que um usuário não consiga "ocupar" o op id de outro.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE sync_push_log (
    user_id        uuid        NOT NULL,
    client_op_id   uuid        NOT NULL,
    server_version bigint      NOT NULL,
    processed_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_sync_push_log PRIMARY KEY (user_id, client_op_id),
    CONSTRAINT fk_sync_push_log_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
);

-- Para o expurgo periódico de entradas antigas do log.
CREATE INDEX ix_sync_push_log_processed_at ON sync_push_log (processed_at);
