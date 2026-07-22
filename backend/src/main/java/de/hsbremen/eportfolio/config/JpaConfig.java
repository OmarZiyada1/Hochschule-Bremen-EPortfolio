package de.hsbremen.eportfolio.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Aktiviert das JPA-Auditing, damit die Zeitstempel der Entities automatisch gesetzt werden.
 */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
