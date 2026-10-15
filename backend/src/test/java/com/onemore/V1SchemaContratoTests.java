package com.onemore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Contrato da V1 (T-001) além do coberto em {@link BaselineMigrationTests}: defaults, todos os
 * CHECKs, colunas de sync obrigatórias, sequência global e integridade referencial.
 * Fonte: docs/requisitos.txt, "Modelo de dados inicial" e "Arquitetura offline-first".
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class V1SchemaContratoTests {

    private static final List<String> COLUNAS_SYNC =
            List.of("id", "user_id", "created_at", "updated_at", "server_version", "deleted_at");

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void limpar() {
        jdbc.execute("TRUNCATE app_user CASCADE");
    }

    @Test
    void userSettingsTemTodasAsColunasDeSyncComTiposCorretos() {
        Map<String, String> tipos = tiposDasColunas("user_settings");
        assertThat(tipos).containsKeys(COLUNAS_SYNC.toArray(String[]::new));
        assertThat(tipos).containsEntry("id", "uuid")
                .containsEntry("user_id", "uuid")
                .containsEntry("created_at", "timestamp with time zone")
                .containsEntry("updated_at", "timestamp with time zone")
                .containsEntry("server_version", "bigint")
                .containsEntry("deleted_at", "timestamp with time zone")
                .containsEntry("incremento_kg", "numeric");
    }

    @Test
    void appUserTemColunasDeControleEDatasEmTimestamptz() {
        Map<String, String> tipos = tiposDasColunas("app_user");
        // app_user não tem user_id: o próprio id é o usuário.
        assertThat(tipos).containsKeys("id", "created_at", "updated_at", "server_version", "deleted_at",
                "email", "nome", "unidade", "meta_dias_semana", "fuso", "consentimentos");
        assertThat(tipos).containsEntry("created_at", "timestamp with time zone")
                .containsEntry("updated_at", "timestamp with time zone")
                .containsEntry("consentimentos", "jsonb");
    }

    @Test
    void indicesDePullEIdempotenciaExistem() {
        List<String> indices = jdbc.queryForList(
                "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'", String.class);
        assertThat(indices).anyMatch(d -> d.contains("ix_user_settings_pull") && d.contains("(user_id, server_version)"));
        assertThat(indices).anyMatch(d -> d.contains("pk_sync_push_log") && d.contains("(user_id, client_op_id)"));
    }

    @Test
    void insertSemServerVersionFuncionaPoisOTriggerPreencheAntesDoNotNull() {
        UUID userId = UUID.randomUUID();
        jdbc.update("INSERT INTO app_user (id, email, created_at, updated_at) VALUES (?, 'sv@exemplo.com', now(), now())", userId);
        UUID settingsId = UUID.randomUUID();
        jdbc.update("INSERT INTO user_settings (id, user_id, created_at, updated_at) VALUES (?, ?, now(), now())",
                settingsId, userId);

        assertThat(versao("app_user", userId)).isPositive();
        assertThat(versao("user_settings", settingsId)).isPositive();
    }

    @Test
    void updateQueTentaForcarServerVersionEhIgnorado() {
        UUID userId = inserirUsuario("forca@exemplo.com");
        long antes = versao("app_user", userId);

        jdbc.update("UPDATE app_user SET server_version = 1 WHERE id = ?", userId);

        assertThat(versao("app_user", userId)).isGreaterThan(antes).isNotEqualTo(1L);
    }

    @Test
    void serverVersionEhUmaSequenciaGlobalEntreTabelas() {
        UUID userId = inserirUsuario("global@exemplo.com");
        UUID settingsId = inserirSettings(userId);
        jdbc.update("UPDATE app_user SET nome = 'X' WHERE id = ?", userId);

        long vUser1 = versao("app_user", userId);
        long vSettings = versao("user_settings", settingsId);
        // Updates alternados entre tabelas nunca repetem versão: o pull usa um único cursor.
        assertThat(vUser1).isGreaterThan(vSettings);
        jdbc.update("UPDATE user_settings SET tema = 'papel' WHERE id = ?", settingsId);
        assertThat(versao("user_settings", settingsId)).isGreaterThan(vUser1);
    }

    @Test
    void defaultsDoAppUser() {
        UUID id = inserirUsuario("def@exemplo.com");
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT unidade, meta_dias_semana, fuso, consentimentos::text AS c, deleted_at FROM app_user WHERE id = ?", id);

        assertThat(row.get("unidade")).isEqualTo("kg");
        assertThat(((Number) row.get("meta_dias_semana")).intValue()).isEqualTo(3);
        assertThat(row.get("fuso")).isEqualTo("UTC");
        assertThat(row.get("c")).isEqualTo("{}");
        assertThat(row.get("deleted_at")).isNull();
    }

    @Test
    void defaultsDoUserSettings() {
        UUID id = inserirSettings(inserirUsuario("defs@exemplo.com"));
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT incremento_kg, anilhas::text AS a, tema, gamificacao_ativa, inicio_semana FROM user_settings WHERE id = ?", id);

        assertThat((BigDecimal) row.get("incremento_kg")).isEqualByComparingTo("2.50");
        assertThat(((BigDecimal) row.get("incremento_kg")).scale()).isEqualTo(2);
        assertThat(row.get("a")).isEqualTo("[]");
        assertThat(row.get("tema")).isEqualTo("sistema");
        assertThat(row.get("gamificacao_ativa")).isEqualTo(true);
        // RN-24: semana começa na segunda (ISO 1).
        assertThat(((Number) row.get("inicio_semana")).intValue()).isEqualTo(1);
    }

    @Test
    void cargaEmKgArmazenadaComDuasCasas() {
        UUID id = inserirSettings(inserirUsuario("kg@exemplo.com"));
        jdbc.update("UPDATE user_settings SET incremento_kg = 1.25 WHERE id = ?", id);
        BigDecimal kg = jdbc.queryForObject("SELECT incremento_kg FROM user_settings WHERE id = ?", BigDecimal.class, id);
        assertThat(kg).isEqualByComparingTo("1.25");
        assertThat(kg.scale()).isEqualTo(2);
    }

    @Test
    void valoresValidosNosLimitesSaoAceitos() {
        UUID userId = inserirUsuario("lim@exemplo.com");
        UUID settingsId = inserirSettings(userId);

        jdbc.update("UPDATE app_user SET unidade = 'lb', meta_dias_semana = 1 WHERE id = ?", userId);
        jdbc.update("UPDATE app_user SET meta_dias_semana = 7 WHERE id = ?", userId);
        for (String tema : List.of("sistema", "papel", "noite")) {
            jdbc.update("UPDATE user_settings SET tema = ? WHERE id = ?", tema, settingsId);
        }
        jdbc.update("UPDATE user_settings SET inicio_semana = 7, incremento_kg = 0.01 WHERE id = ?", settingsId);
        jdbc.update("UPDATE user_settings SET anilhas = '[{\"kg\": 20.00, \"qtd\": 2}]'::jsonb WHERE id = ?", settingsId);
        jdbc.update("UPDATE app_user SET consentimentos = '{\"medidas_corporais\": {\"concedido\": true}}'::jsonb WHERE id = ?", userId);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "UPDATE app_user SET meta_dias_semana = 0 WHERE id = ?",
            "UPDATE app_user SET unidade = 'KG' WHERE id = ?",
            "UPDATE app_user SET consentimentos = '[]'::jsonb WHERE id = ?",
            "UPDATE app_user SET consentimentos = 'null'::jsonb WHERE id = ?",
            "UPDATE app_user SET email = NULL WHERE id = ?",
            "UPDATE app_user SET created_at = NULL WHERE id = ?",
            "UPDATE app_user SET updated_at = NULL WHERE id = ?",
    })
    void appUserRejeitaValoresForaDoDominio(String sql) {
        UUID userId = inserirUsuario("dom@exemplo.com");
        assertThatThrownBy(() -> jdbc.update(sql, userId)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "UPDATE user_settings SET tema = 'escuro' WHERE id = ?",
            "UPDATE user_settings SET inicio_semana = 0 WHERE id = ?",
            "UPDATE user_settings SET inicio_semana = 8 WHERE id = ?",
            "UPDATE user_settings SET incremento_kg = -2.5 WHERE id = ?",
            "UPDATE user_settings SET incremento_kg = 1000 WHERE id = ?",
            "UPDATE user_settings SET anilhas = '{}'::jsonb WHERE id = ?",
            "UPDATE user_settings SET user_id = NULL WHERE id = ?",
            "UPDATE user_settings SET created_at = NULL WHERE id = ?",
    })
    void userSettingsRejeitaValoresForaDoDominio(String sql) {
        UUID settingsId = inserirSettings(inserirUsuario("doms@exemplo.com"));
        assertThatThrownBy(() -> jdbc.update(sql, settingsId)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void idDuplicadoEhRejeitado() {
        UUID id = inserirUsuario("dup@exemplo.com");
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO app_user (id, email, created_at, updated_at) VALUES (?, 'outro@exemplo.com', now(), now())", id))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void userSettingsEPushLogExigemUsuarioExistente() {
        UUID fantasma = UUID.randomUUID();
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO user_settings (id, user_id, created_at, updated_at) VALUES (?, ?, now(), now())",
                UUID.randomUUID(), fantasma))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO sync_push_log (user_id, client_op_id, server_version) VALUES (?, ?, 1)",
                fantasma, UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void tombstoneDeUserSettingsNaoLiberaSegundoRegistroDoMesmoUsuario() {
        // "Um registro por usuário" vale mesmo com tombstone: o app deve reativar o existente.
        UUID userId = inserirUsuario("tomb@exemplo.com");
        UUID settingsId = inserirSettings(userId);
        jdbc.update("UPDATE user_settings SET deleted_at = now() WHERE id = ?", settingsId);

        assertThatThrownBy(() -> inserirSettings(userId)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void variasContasExcluidasComMesmoEmailMasNaoReativarSeHaAtiva() {
        UUID a = inserirUsuario("rep@exemplo.com");
        jdbc.update("UPDATE app_user SET deleted_at = now() WHERE id = ?", a);
        UUID b = inserirUsuario("REP@exemplo.com");
        jdbc.update("UPDATE app_user SET deleted_at = now() WHERE id = ?", b);
        inserirUsuario("rep@exemplo.com");

        // Reativar uma conta excluída enquanto há outra ativa com o mesmo e-mail viola a unicidade.
        assertThatThrownBy(() -> jdbc.update("UPDATE app_user SET deleted_at = NULL WHERE id = ?", a))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void pushLogGuardaServerVersionDaPrimeiraAplicacaoEDataDeProcessamento() {
        UUID userId = inserirUsuario("log@exemplo.com");
        UUID opId = UUID.randomUUID();
        String sql = "INSERT INTO sync_push_log (user_id, client_op_id, server_version) VALUES (?, ?, ?) ON CONFLICT DO NOTHING";
        jdbc.update(sql, userId, opId, 42L);
        jdbc.update(sql, userId, opId, 99L);

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT server_version, processed_at FROM sync_push_log WHERE user_id = ? AND client_op_id = ?", userId, opId);
        assertThat(((Number) row.get("server_version")).longValue()).isEqualTo(42L);
        assertThat(row.get("processed_at")).isNotNull();
    }

    @Test
    void flywayAplicouSomenteAV1ComSucesso() {
        List<Map<String, Object>> hist = jdbc.queryForList(
                "SELECT version, success FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank");
        assertThat(hist).hasSize(1);
        assertThat(hist.get(0)).containsEntry("version", "1").containsEntry("success", true);
    }

    private Map<String, String> tiposDasColunas(String tabela) {
        Map<String, String> tipos = new java.util.HashMap<>();
        jdbc.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ?",
                rs -> { tipos.put(rs.getString(1), rs.getString(2)); }, tabela);
        return tipos;
    }

    private UUID inserirUsuario(String email) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_user (id, email, created_at, updated_at) VALUES (?, ?, now(), now())", id, email);
        return id;
    }

    private UUID inserirSettings(UUID userId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO user_settings (id, user_id, created_at, updated_at) VALUES (?, ?, now(), now())", id, userId);
        return id;
    }

    private long versao(String tabela, UUID id) {
        return jdbc.queryForObject("SELECT server_version FROM " + tabela + " WHERE id = ?", Long.class, id);
    }
}
