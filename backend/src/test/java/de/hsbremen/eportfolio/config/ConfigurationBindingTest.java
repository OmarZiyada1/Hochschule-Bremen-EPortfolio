package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * Belegt die Fail-Fast-Regel aus API-Contract §6.8: fehlt ein Pflichtwert der
 * Fremddienste, startet der Kontext nicht, und die Meldung nennt den Schluessel.
 *
 * <p>Bewusst kein {@code @SpringBootTest}: geprueft wird die Bindung der beiden
 * Property-Records, nicht die Anwendung. Ein voller Kontext braeuchte eine
 * Datenbank und wuerde in genau dem Fall, den dieser Test herstellt, schon an
 * anderer Stelle scheitern. Der {@link ApplicationContextRunner} laesst
 * stattdessen jede Konstellation einzeln laufen.
 */
class ConfigurationBindingTest {

	private static final String CONNECTION_STRING =
			"DefaultEndpointsProtocol=https;AccountName=eportfolio;AccountKey=streng-geheim;"
					+ "EndpointSuffix=core.windows.net";

	/**
	 * Die drei Werte, die {@link MailProperties} in jedem Profil braucht. Sie
	 * stehen in {@code application.yml} und wuerden hier sonst jeden Storage-Fall
	 * mit einem zweiten Fehler ueberlagern.
	 */
	private static final String[] MAIL_DEFAULTS = {
			"app.mail.provider=log",
			"app.mail.from-address=noreply@eportfolio.invalid",
			"app.mail.from-name=E-Portfolio Hochschule Bremen",
			"app.mail.base-url=http://localhost:5173"
	};

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
			.withUserConfiguration(PropertiesUnderTest.class);

	@Test
	@DisplayName("Vollstaendige Entwicklungskonfiguration startet")
	void devConfigurationStarts() {
		runner.withPropertyValues("app.storage.provider=local")
				.withPropertyValues(MAIL_DEFAULTS)
				.run(context -> {
					assertThat(context).hasNotFailed();
					assertThat(context.getBean(StorageProperties.class).provider())
							.isEqualTo(StorageProvider.LOCAL);
					assertThat(context.getBean(MailProperties.class).provider())
							.isEqualTo(MailProvider.LOG);
				});
	}

	@Test
	@DisplayName("Vollstaendige Betriebskonfiguration startet")
	void prodConfigurationStarts() {
		runner.withPropertyValues(
						"app.storage.provider=azure",
						"app.storage.container=eportfolio-files",
						"app.storage.connection-string=" + CONNECTION_STRING)
				.withPropertyValues(MAIL_DEFAULTS)
				.withPropertyValues("app.mail.provider=smtp")
				.run(context -> {
					assertThat(context).hasNotFailed();
					assertThat(context.getBean(StorageProperties.class).container())
							.isEqualTo("eportfolio-files");
				});
	}

	@Test
	@DisplayName("Fehlende Speicher-Auswahl laesst den Kontext scheitern, kein stiller Rueckfall auf local")
	void missingStorageProviderFails() {
		runner.withPropertyValues(MAIL_DEFAULTS)
				.run(context -> assertThat(context).hasFailed()
						.getFailure()
						.hasStackTraceContaining("app.storage.provider"));
	}

	@Test
	@DisplayName("Fehlende Mail-Auswahl laesst den Kontext scheitern, kein stiller Rueckfall auf log")
	void missingMailProviderFails() {
		runner.withPropertyValues("app.storage.provider=local")
				.withPropertyValues(
						"app.mail.from-address=noreply@eportfolio.invalid",
						"app.mail.from-name=E-Portfolio Hochschule Bremen",
						"app.mail.base-url=http://localhost:5173")
				.run(context -> assertThat(context).hasFailed()
						.getFailure()
						.hasStackTraceContaining("app.mail.provider"));
	}

	@Test
	@DisplayName("Azure ohne Zugangsdaten scheitert und nennt den fehlenden Schluessel")
	void azureWithoutCredentialsFails() {
		runner.withPropertyValues("app.storage.provider=azure")
				.withPropertyValues(MAIL_DEFAULTS)
				.run(context -> assertThat(context).hasFailed()
						.getFailure()
						.hasStackTraceContaining("app.storage.container")
						.hasStackTraceContaining("app.storage.connection-string"));
	}

	@Test
	@DisplayName("Fehlende Umgebungsvariable scheitert, statt den Platzhalter als Container zu binden")
	void unresolvedPlaceholderFails() {
		// Genau so sieht application-prod.yml aus, wenn AZURE_STORAGE_CONTAINER
		// in der Umgebung fehlt: Spring bindet die Zeichenfolge, statt zu
		// scheitern. Siehe UnresolvedPlaceholderTest.
		runner.withPropertyValues(
						"app.storage.provider=azure",
						"app.storage.container=${AZURE_STORAGE_CONTAINER}",
						"app.storage.connection-string=" + CONNECTION_STRING)
				.withPropertyValues(MAIL_DEFAULTS)
				.run(context -> assertThat(context).hasFailed()
						.getFailure()
						.hasStackTraceContaining("app.storage.container"));
	}

	@Test
	@DisplayName("Vertippter Provider scheitert beim Start, nicht erst beim ersten Upload")
	void unknownStorageProviderFails() {
		runner.withPropertyValues("app.storage.provider=azrue")
				.withPropertyValues(MAIL_DEFAULTS)
				.run(context -> assertThat(context).hasFailed()
						.getFailure()
						.hasStackTraceContaining("app.storage.provider"));
	}

	@Test
	@DisplayName("Absenderadresse ohne @ scheitert beim Start")
	void invalidFromAddressFails() {
		runner.withPropertyValues("app.storage.provider=local")
				.withPropertyValues(MAIL_DEFAULTS)
				.withPropertyValues("app.mail.from-address=kein-absender")
				.run(context -> assertThat(context).hasFailed()
						.getFailure()
						.hasStackTraceContaining("app.mail.from-address"));
	}

	@Configuration(proxyBeanMethods = false)
	@EnableConfigurationProperties({ StorageProperties.class, MailProperties.class })
	static class PropertiesUnderTest {
	}
}
