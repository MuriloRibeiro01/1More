package com.onemore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// Sem usuário em memória com senha gerada: a autenticação real (JWT) entra na T-002.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class OneMoreApplication {

    public static void main(String[] args) {
        SpringApplication.run(OneMoreApplication.class, args);
    }
}
