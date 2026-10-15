package com.onemore;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OneMoreApplicationTests {

    @Autowired
    TestRestTemplate rest;

    @Test
    @SuppressWarnings("rawtypes")
    void healthEhPublicoEUp() {
        ResponseEntity<Map> resp = rest.getForEntity("/actuator/health", Map.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("status", "UP");
        // show-details=never fora do perfil dev: nada de detalhes da infraestrutura no endpoint público.
        assertThat(resp.getBody()).doesNotContainKey("components");
    }

    @Test
    void demaisRotasExigemAutenticacao() {
        assertThat(rest.getForEntity("/api/v1/qualquer", String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(rest.getForEntity("/actuator/env", String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
