package de.hsbremen.eportfolio.mail;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.config.MailProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * Belegt, dass {@code app.mail.provider} tatsaechlich den Adapter auswaehlt
 * (KAN-51, API-Contract §6.8).
 *
 * <p><strong>Warum das ein eigener Test ist.</strong> Die Auswahl haengt an zwei
 * {@code @ConditionalOnProperty}-Annotationen. Ein Tippfehler darin faellt beim
 * Uebersetzen nicht auf und im Profil dev auch nicht, weil dort ohnehin der
 * Log-Adapter richtig waere. Bemerkt wuerde er erst im Betrieb, und zwar in der
 * gefaehrlichen Richtung: ein Produktivsystem, das Verifizierungscodes ins Log
 * schreibt statt sie zu versenden, faellt erst auf, wenn sich niemand mehr
 * registrieren kann (§6.8).
 *
 * <p><strong>Die Adapter werden gescannt und nicht als {@code @Bean} gestellt.</strong>
 * Eine {@code @Bean}-Methode wuerde die Annotation an der Klasse uebergehen, und
 * der Test bestaetigte dann nur die Verdrahtung im Test selbst. Der Filter
 * beschraenkt den Scan auf die beiden Adapter, damit der Kontext ohne
 * {@code MailTemplateService} und ohne Datenbank auskommt.
 *
 * <p>Der Fall „Property fehlt ganz" steht nicht hier, sondern in
 * {@code ConfigurationBindingTest}: dort scheitert schon die Bindung von
 * {@link MailProperties}, die Anwendung kommt also gar nicht bis zur
 * Adapterauswahl.
 */
class MailAdapterSelectionTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
			.withUserConfiguration(MailAdaptersUnderTest.class)
			.withPropertyValues(
					"app.mail.from-address=noreply@eportfolio.invalid",
					"app.mail.from-name=E-Portfolio Hochschule Bremen",
					"app.mail.base-url=http://localhost:5173");

	@Test
	@DisplayName("provider=log aktiviert den Log-Adapter, und nur ihn")
	void logProviderSelectsLogAdapter() {
		runner.withPropertyValues("app.mail.provider=log").run(context -> {
			assertThat(context).hasNotFailed();
			assertThat(context).hasSingleBean(MailSender.class);
			assertThat(context).hasSingleBean(LogMailSender.class);
			assertThat(context).doesNotHaveBean(SmtpMailSender.class);
		});
	}

	@Test
	@DisplayName("provider=smtp aktiviert den SMTP-Adapter, und nur ihn")
	void smtpProviderSelectsSmtpAdapter() {
		runner.withPropertyValues("app.mail.provider=smtp").run(context -> {
			assertThat(context).hasNotFailed();
			assertThat(context).hasSingleBean(MailSender.class);
			assertThat(context).hasSingleBean(SmtpMailSender.class);
			assertThat(context).doesNotHaveBean(LogMailSender.class);
		});
	}

	@Configuration(proxyBeanMethods = false)
	@EnableConfigurationProperties(MailProperties.class)
	@ComponentScan(
			basePackageClasses = MailSender.class,
			useDefaultFilters = false,
			includeFilters = @ComponentScan.Filter(
					type = FilterType.ASSIGNABLE_TYPE,
					classes = { LogMailSender.class, SmtpMailSender.class }))
	static class MailAdaptersUnderTest {

		/**
		 * Steht nur da, damit der SMTP-Adapter ueberhaupt gebaut werden kann. Die
		 * Auswahl haengt an der Property und nicht an diesem Bean; verschickt wird
		 * in diesem Test nichts.
		 *
		 * <p>Der Host muss gesetzt sein, weil {@code SmtpMailSender} ihn beim Bau
		 * prueft (siehe {@code SmtpMailSenderTest.missingRelayHostFailsAtStartup}).
		 */
		@Bean
		JavaMailSender javaMailSender() {
			JavaMailSenderImpl javaMailSender = new JavaMailSenderImpl();
			javaMailSender.setHost("localhost");
			return javaMailSender;
		}
	}
}
