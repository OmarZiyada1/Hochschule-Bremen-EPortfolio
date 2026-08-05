package de.hsbremen.eportfolio.config;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Protokolliert beim Start je Port aus API-Contract §6.8, welcher Adapter aktiv
 * ist.
 *
 * <p><strong>Warum ueberhaupt.</strong> Welcher Speicher und welcher Mailweg
 * benutzt werden, entscheidet eine Property, die auf einem fremden System aus
 * Umgebungsvariablen kommt und nirgends sichtbar ist. Ohne diese beiden Zeilen
 * laesst sich einem laufenden Prozess nicht ansehen, ob er gerade gegen den
 * Azure-Container oder in ein lokales Verzeichnis schreibt: ein Unterschied,
 * der sonst erst beim ersten fehlenden Bild auffaellt.
 *
 * <p><strong>Was hier niemals landet.</strong> Kein Kontoschluessel, kein
 * Passwort, keine Verbindungszeichenfolge. Aus der Verbindungszeichenfolge wird
 * ausschliesslich der Kontoname herausgeloest, weil erst er die Zeile
 * beantworten laesst, gegen <em>welches</em> Speicherkonto gearbeitet wird.
 * {@code ConfigurationStartupLoggerTest} haelt fest, dass der Schluessel nicht
 * im Log auftaucht.
 *
 * <p>Gehaengt an {@link ApplicationReadyEvent} und nicht an den Konstruktor:
 * so steht die Zeile am Ende des Startprotokolls und nicht zwischen den
 * Bean-Meldungen.
 */
@Component
public class ConfigurationStartupLogger {

	private static final Logger LOG = LoggerFactory.getLogger(ConfigurationStartupLogger.class);

	/** Schluessel innerhalb der Azure-Verbindungszeichenfolge, ungefaehrlich. */
	private static final String ACCOUNT_NAME_PREFIX = "AccountName=";

	/** Ersatztext, wenn der Kontoname nicht ermittelbar ist. */
	private static final String UNKNOWN = "unbekannt";

	private final StorageProperties storage;

	private final MailProperties mail;

	public ConfigurationStartupLogger(StorageProperties storage, MailProperties mail) {
		this.storage = storage;
		this.mail = mail;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void logActiveAdapters() {
		LOG.info("Konfiguration: {}", storageLine());
		LOG.info("Konfiguration: {}", mailLine());
	}

	/**
	 * Eine Zeile fuer den Port {@code FileStorage}. Bei {@code azure} zusaetzlich
	 * Speicherkonto und Container, weil erst beides den Ablageort eindeutig
	 * bezeichnet; bei {@code local} das Verzeichnis.
	 */
	String storageLine() {
		if (storage.provider() == StorageProvider.AZURE) {
			return "Speicher-Adapter=azure, Speicherkonto=%s, Container=%s"
					.formatted(accountName(storage.connectionString()), storage.container());
		}
		return "Speicher-Adapter=local, Verzeichnis=%s".formatted(storage.localDirectory().toAbsolutePath());
	}

	/**
	 * Eine Zeile fuer den Port {@code MailSender}. Der Absender steht mit dabei,
	 * weil eine falsche Absenderdomain der haeufigste Grund dafuer ist, dass ein
	 * Relay Nachrichten stillschweigend verwirft.
	 */
	String mailLine() {
		return "Mail-Adapter=%s, Absender=%s".formatted(
				mail.provider().name().toLowerCase(Locale.ROOT), mail.fromAddress());
	}

	/**
	 * Liest den Kontonamen aus der Verbindungszeichenfolge.
	 *
	 * <p>Bewusst nur dieses eine Feld und kein allgemeines Zerlegen: was die
	 * Methode nicht kennt, kann sie auch nicht versehentlich protokollieren. Der
	 * Kontoschluessel steht in derselben Zeichenfolge.
	 */
	private static String accountName(String connectionString) {
		if (connectionString == null) {
			return UNKNOWN;
		}
		for (String part : connectionString.split(";")) {
			String trimmed = part.trim();
			if (trimmed.startsWith(ACCOUNT_NAME_PREFIX)) {
				String name = trimmed.substring(ACCOUNT_NAME_PREFIX.length());
				return name.isBlank() ? UNKNOWN : name;
			}
		}
		return UNKNOWN;
	}
}
