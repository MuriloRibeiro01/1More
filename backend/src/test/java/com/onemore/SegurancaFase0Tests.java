package com.onemore;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/** Segurança mínima da T-001: só o health (e suas probes) é público; nada vaza no 401. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SegurancaFase0Tests {

    @Autowired
    TestRestTemplate rest;

    @ParameterizedTest
    @ValueSource(strings = {"/actuator/health/liveness", "/actuator/health/readiness"})
    @SuppressWarnings("rawtypes")
    void probesDoHealthSaoPublicasEUp(String path) {
        ResponseEntity<Map> resp = rest.getForEntity(path, Map.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("status", "UP");
    }

    @Test
    void componentesDoHealthNaoSaoExpostosPublicamente() {
        // Com show-details=never o componente db não deve ser acessível por subpath.
        HttpStatus status = HttpStatus.valueOf(rest.getForEntity("/actuator/health/db", String.class).getStatusCode().value());
        assertThat(status).isIn(HttpStatus.NOT_FOUND, HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/", "/actuator", "/actuator/info", "/actuator/metrics", "/actuator/beans",
            "/actuator/heapdump", "/api/v1/sync/pull", "/error", "/actuator/healthx"})
    void rotasNaoPublicasRespondem401SemCorpo(String path) {
        ResponseEntity<String> resp = rest.getForEntity(path, String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getBody()).isNullOrEmpty();
    }

    @Test
    void postSemAutenticacaoEh401ENao403DeCsrf() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> resp = rest.exchange("/api/v1/sync/push", HttpMethod.POST, new HttpEntity<>("{}", h), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void naoHaHttpBasicNemFormLoginNemSessao() {
        HttpHeaders h = new HttpHeaders();
        h.setBasicAuth("user", "password");
        ResponseEntity<String> resp = rest.exchange("/api/v1/qualquer", HttpMethod.GET, new HttpEntity<>(h), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getHeaders().getFirst(HttpHeaders.WWW_AUTHENTICATE)).isNull();
        assertThat(resp.getHeaders().get(HttpHeaders.SET_COOKIE)).isNullOrEmpty();

        assertThat(rest.getForEntity("/login", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void healthPublicoNaoCriaSessao() {
        ResponseEntity<String> resp = rest.getForEntity("/actuator/health", String.class);
        assertThat(resp.getHeaders().get(HttpHeaders.SET_COOKIE)).isNullOrEmpty();
    }
}
