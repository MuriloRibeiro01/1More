package com.onemore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Verifica as garantias de sync da V1 direto no Postgres (Flyway aplicado pelo contexto). */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BaselineMigrationTests {

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void limpar() {
        jdbc.execute("TRUNCATE app_user CASCADE");
    }

    @Test
    void serverVersionEhAtribuidaPeloServidorEAvancaACadaUpdate() {
        UUID userId = inserirUsuario("ana@exemplo.com");
        UUID settingsId = UUID.randomUUID();
        // Valor de server_version enviado pelo cliente é ignorado pelo trigger.
        jdbc.update("""
                INSERT INTO user_settings (id, user_id, created_at, updated_at, server_version)
                VALUES (?, ?, now(), now(), 999999)""", settingsId, userId);

        long v1 = versao("user_settings", settingsId);
        assertThat(v1).isNotEqualTo(999999L).isGreaterThan(versao("app_user", userId));

        jdbc.update("UPDATE user_settings SET tema = 'noite' WHERE id = ?", settingsId);
        long v2 = versao("user_settings", settingsId);
        assertThat(v2).isGreaterThan(v1);

        // Tombstone também gera versão nova, para o pull entregar a exclusão.
        jdbc.update("UPDATE user_settings SET deleted_at = now() WHERE id = ?", settingsId);
        assertThat(versao("user_settings", settingsId)).isGreaterThan(v2);
    }

    @Test
    void emailUnicoSemDiferenciarCaixaApenasEntreContasAtivas() {
        UUID primeira = inserirUsuario("Bia@Exemplo.com");

        assertThatThrownBy(() -> inserirUsuario("bia@exemplo.com"))
                .isInstanceOf(DataIntegrityViolationException.class);

        jdbc.update("UPDATE app_user SET deleted_at = now() WHERE id = ?", primeira);
        inserirUsuario("bia@exemplo.com");
    }

    @Test
    void umUserSettingsPorUsuario() {
        UUID userId = inserirUsuario("caio@exemplo.com");
        String sql = "INSERT INTO user_settings (id, user_id, created_at, updated_at, server_version) VALUES (?, ?, now(), now(), 0)";
        jdbc.update(sql, UUID.randomUUID(), userId);

        assertThatThrownBy(() -> jdbc.update(sql, UUID.randomUUID(), userId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void constraintsDeDominio() {
        UUID userId = inserirUsuario("davi@exemplo.com");

        assertThatThrownBy(() -> jdbc.update("UPDATE app_user SET unidade = 'g' WHERE id = ?", userId))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE app_user SET meta_dias_semana = 8 WHERE id = ?", userId))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO user_settings (id, user_id, created_at, updated_at, server_version, incremento_kg) VALUES (?, ?, now(), now(), 0, 0)",
                UUID.randomUUID(), userId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void pushLogIgnoraReenvioDoMesmoOpIdPorUsuario() {
        UUID ana = inserirUsuario("eva@exemplo.com");
        UUID beto = inserirUsuario("beto@exemplo.com");
        UUID opId = UUID.randomUUID();
        String sql = "INSERT INTO sync_push_log (user_id, client_op_id, server_version) VALUES (?, ?, 1) ON CONFLICT DO NOTHING";

        assertThat(jdbc.update(sql, ana, opId)).isEqualTo(1);
        assertThat(jdbc.update(sql, ana, opId)).isZero();
        // O mesmo op id de outro usuário não colide.
        assertThat(jdbc.update(sql, beto, opId)).isEqualTo(1);
    }

    private UUID inserirUsuario(String email) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO app_user (id, email, created_at, updated_at, server_version)
                VALUES (?, ?, now(), now(), 0)""", id, email);
        return id;
    }

    private long versao(String tabela, UUID id) {
        return jdbc.queryForObject("SELECT server_version FROM " + tabela + " WHERE id = ?", Long.class, id);
    }
}
