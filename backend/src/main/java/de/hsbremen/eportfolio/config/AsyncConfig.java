package de.hsbremen.eportfolio.config;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Schaltet {@code @Async} ein und stellt den Executor fuer den Mailversand
 * bereit (KAN-51, API-Contract §6.8).
 *
 * <p><strong>Warum ein eigener Executor und nicht der Standard.</strong> Springs
 * Vorgabe legt fuer jede Aufgabe einen neuen Thread an, unbegrenzt. Ein
 * Mailserver, der nicht mehr antwortet, wuerde damit bei jedem Registrierungs-
 * versuch einen weiteren Thread binden, der in einem Netzwerk-Timeout haengt.
 * Der begrenzte Pool hier macht daraus eine feste Obergrenze.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

	/** Bean-Name des Mail-Executors, referenziert in {@code @Async}. */
	public static final String MAIL_EXECUTOR = "mailTaskExecutor";

	private static final Logger LOG = LoggerFactory.getLogger(AsyncConfig.class);

	/**
	 * Kleiner Pool mit begrenzter Warteschlange.
	 *
	 * <p>Die Groessen sind an der erwarteten Last ausgerichtet: Mails entstehen
	 * bei Registrierung und Passwortruecksetzung, also einzeln und selten, nicht
	 * im Stapel. Zwei Threads reichen dafuer; die Warteschlange faengt eine
	 * kurzzeitige Haeufung ab, etwa mehrere Registrierungen in einem
	 * Usability-Test.
	 *
	 * <p><strong>Was bei voller Warteschlange passiert, ist die eigentliche
	 * Entscheidung.</strong> Die uebliche Ablehnungsstrategie
	 * {@code CallerRunsPolicy} liesse den Versand im aufrufenden Thread laufen und
	 * damit genau die Blockade entstehen, die §6.8 ausschliesst: die Antwort auf
	 * {@code POST /auth/register} haenge dann doch an der Erreichbarkeit des
	 * Relays. {@code AbortPolicy} wiederum wuerde die
	 * {@code RejectedExecutionException} im aufrufenden Thread werfen und den
	 * Fachvorgang scheitern lassen. Deshalb wird verworfen und protokolliert: der
	 * Wiederholungsweg ist {@code POST /auth/verify/resend} durch die Person
	 * selbst.
	 */
	@Bean(MAIL_EXECUTOR)
	public Executor mailTaskExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(2);
		executor.setMaxPoolSize(4);
		executor.setQueueCapacity(50);
		// Macht die Herkunft einer Logzeile erkennbar, wenn der Versand
		// fehlschlaegt.
		executor.setThreadNamePrefix("mail-");
		executor.setRejectedExecutionHandler(AsyncConfig::discardAndLog);
		executor.initialize();
		return executor;
	}

	private static void discardAndLog(Runnable rejected, ThreadPoolExecutor executor) {
		LOG.error("Mailversand verworfen: Warteschlange voll ({} Aufgaben). "
				+ "Der Code kann ueber POST /auth/verify/resend erneut angefordert werden.",
				executor.getQueue().size());
	}
}
