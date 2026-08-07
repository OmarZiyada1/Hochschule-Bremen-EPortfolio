package de.hsbremen.eportfolio.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import de.hsbremen.eportfolio.config.AsyncConfig;
import de.hsbremen.eportfolio.config.MailProperties;
import de.hsbremen.eportfolio.config.MailProvider;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Belegt die Zusage aus API-Contract §6.8, dass der Versand den Fachvorgang
 * nicht blockiert, auf dem Weg, den die Anwendung im Betrieb wirklich nimmt.
 *
 * <p><strong>Warum das ein eigener Test neben {@code MailTemplateServiceTest}
 * ist.</strong> Jener prueft den {@code try/catch} und laeuft dafuer bewusst
 * ohne Spring, also synchron. Damit bleibt die Haelfte unbewiesen, die im
 * Betrieb den Unterschied macht: der {@code try/catch} liegt <em>innerhalb</em>
 * der {@code @Async}-Methode, und alles, was die Async-Maschinerie selbst wirft,
 * wird im <em>aufrufenden</em> Thread geworfen und laeuft an der Behandlung
 * vorbei. Ein fehlendes oder umbenanntes Executor-Bean ergaebe genau dort eine
 * Ausnahme, und {@code POST /auth/register} antwortete mit 500 statt 201.
 *
 * <p>Ebenso wuerde ein entfernter {@code @Async}-Zusatz den Versand still
 * synchron machen, ohne dass ein anderer Test rot wird.
 */
class MailAsyncDispatchTest {

	private static final MailProperties PROPERTIES = new MailProperties(
			MailProvider.LOG, "noreply@eportfolio.invalid", "E-Portfolio Hochschule Bremen",
			"http://localhost:5173");

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withUserConfiguration(AsyncConfig.class, DispatchUnderTest.class);

	@Test
	@DisplayName("Der Versand laeuft in einem Thread des Mail-Executors, nicht im aufrufenden")
	void runsOnMailExecutor() {
		runner.withUserConfiguration(RecordingSender.class).run(context -> {
			RecordingMailSender sender = context.getBean(RecordingMailSender.class);
			MailTemplateService service = context.getBean(MailTemplateService.class);
			String callingThread = Thread.currentThread().getName();

			service.sendPrivateEmailVerification("person@example.org", "428193", Duration.ofMinutes(15));

			assertThat(sender.arrived.await(5, TimeUnit.SECONDS))
					.as("Die Nachricht hat den Adapter nie erreicht, @Async greift offenbar nicht")
					.isTrue();
			assertThat(sender.threadName.get())
					.isNotEqualTo(callingThread)
					// Der Praefix stammt aus AsyncConfig und belegt, dass der
					// benannte Executor genommen wurde und nicht Springs Vorgabe.
					.startsWith("mail-");
		});
	}

	@Test
	@DisplayName("Ein werfender Adapter laesst den Aufruf auch ueber den Async-Weg unbeschadet")
	void throwingAdapterStaysContained() {
		runner.withUserConfiguration(ThrowingSender.class).run(context -> {
			MailTemplateService service = context.getBean(MailTemplateService.class);

			// Das ist die Zusicherung, die POST /auth/register mit 201 antworten
			// laesst, obwohl die Mail nicht rausging (§6.8).
			assertThatCode(() -> service.sendPasswordReset(
					"person@example.org", "428193", Duration.ofMinutes(15)))
					.doesNotThrowAnyException();
		});
	}

	@Test
	@DisplayName("Volle Warteschlange wirft nicht beim Aufrufer, sondern verwirft")
	void fullQueueDoesNotThrow() {
		Executor executor = new AsyncConfig().mailTaskExecutor();
		CountDownLatch block = new CountDownLatch(1);

		try {
			// Deutlich mehr Aufgaben als Threads und Warteschlange zusammen
			// fassen, damit die Ablehnung sicher eintritt. Mit der ueblichen
			// AbortPolicy floege spaetestens hier eine
			// RejectedExecutionException in den aufrufenden Thread und damit in
			// den Fachvorgang.
			assertThatCode(() -> {
				for (int i = 0; i < 200; i++) {
					executor.execute(() -> awaitQuietly(block));
				}
			}).doesNotThrowAnyException();
		}
		finally {
			block.countDown();
		}
	}

	private static void awaitQuietly(CountDownLatch latch) {
		try {
			latch.await(5, TimeUnit.SECONDS);
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

	@Configuration(proxyBeanMethods = false)
	static class DispatchUnderTest {

		@Bean
		MailProperties mailProperties() {
			return PROPERTIES;
		}

		@Bean
		MailTemplateService mailTemplateService(MailSender mailSender, MailProperties properties) {
			return new MailTemplateService(mailSender, properties);
		}
	}

	@Configuration(proxyBeanMethods = false)
	static class RecordingSender {

		@Bean
		RecordingMailSender recordingMailSender() {
			return new RecordingMailSender();
		}
	}

	@Configuration(proxyBeanMethods = false)
	static class ThrowingSender {

		@Bean
		MailSender failingMailSender() {
			return message -> {
				throw new IllegalStateException("Relay nicht erreichbar");
			};
		}
	}

	/** Haelt fest, ob und in welchem Thread die Nachricht ankam. */
	static final class RecordingMailSender implements MailSender {

		private final CountDownLatch arrived = new CountDownLatch(1);

		private final AtomicReference<String> threadName = new AtomicReference<>();

		@Override
		public void send(MailMessage message) {
			threadName.set(Thread.currentThread().getName());
			arrived.countDown();
		}
	}
}
