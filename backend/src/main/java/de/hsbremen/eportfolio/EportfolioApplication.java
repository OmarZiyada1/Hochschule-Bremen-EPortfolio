package de.hsbremen.eportfolio;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Einstiegspunkt der Anwendung.
 *
 * <p>{@code @ConfigurationPropertiesScan} registriert die Records mit
 * {@code @ConfigurationProperties} (JWT, CORS, Berechtigung), damit sie ohne
 * zusaetzliches {@code @EnableConfigurationProperties} injizierbar sind.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class EportfolioApplication {

	public static void main(String[] args) {
		SpringApplication.run(EportfolioApplication.class, args);
	}

}
