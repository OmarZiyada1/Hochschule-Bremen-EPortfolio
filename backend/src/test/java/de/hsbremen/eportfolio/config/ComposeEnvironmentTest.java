package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Haelt den Code und die {@code compose}-Dateien zusammen (KAN-99).
 *
 * <p><strong>Der Fehler, den es hier zu verhindern gilt, ist schon einmal
 * passiert.</strong> Beim ersten Ausrollen des {@code InitialAdminSeeder} waren
 * die fuenf {@code BOOTSTRAP_ADMIN_}-Werte in der {@code .env} des Servers
 * gesetzt, in {@code .env.example} dokumentiert und im Java-Code per
 * {@code @Value} gelesen. Nur durchgereicht wurden sie nicht: im
 * {@code environment}-Block von {@code compose.prod.yml} fehlten sie. Der
 * Seeder sah nichts, uebersprang seine Arbeit stillschweigend, und es entstand
 * kein Admin-Konto.
 *
 * <p><strong>Warum das nicht auffiel.</strong> Ein fehlender Wert ist fuer den
 * Seeder kein Fehlerfall, sondern der Regelfall jeder Entwicklungsumgebung; er
 * protokolliert ihn auf {@code debug} und kehrt zurueck. Und im Profil
 * {@code dev} faellt es nie auf, weil dort {@code application-dev.yml} die
 * {@code .env} ueber {@code spring.config.import} einliest. Genau diese Stuetze
 * fehlt im Profil {@code prod} mit Absicht: dort kommen die Werte aus der
 * Umgebung des Prozesses, und die Compose-Dateien sind der einzige Weg dorthin.
 * Die {@code .env} im Projektverzeichnis benutzt Compose nur, um Platzhalter in
 * den Compose-Dateien zu ersetzen, nicht um den Container zu befuellen.
 *
 * <p>Der Test prueft deshalb genau eine Richtung: <strong>was der Code liest,
 * muss im Betrieb ankommen koennen.</strong>
 *
 * <p><strong>Beide Wege in den Code zaehlen.</strong> Die erste Fassung dieses
 * Tests sah nur {@code @Value}-Annotationen an und deckte damit sechs Namen ab.
 * Der Hauptweg lief an ihr vorbei: {@code JWT_SECRET}, die
 * {@code POSTGRES_}-Werte, {@code MAIL_}, {@code AZURE_STORAGE_} und die
 * uebrigen kommen ueber Platzhalter in den {@code application*.yml} und die
 * {@code @ConfigurationProperties}-Records in den Code. Fuer die galt die
 * Zusage des Javadoc, aber nicht die Pruefung. Die Sollmenge ist deshalb die
 * Vereinigung beider Wege.
 *
 * <p><strong>Und beide Compose-Dateien.</strong> Die Umgebung des Containers
 * entsteht aus {@code compose.base.yml} <em>und</em> dem Overlay
 * {@code compose.prod.yml}; {@code JWT_SECRET} und die {@code POSTGRES_}-Werte
 * stehen ausschliesslich in der Basisdatei. Nur das Overlay anzusehen erzeugte
 * Fehlalarme.
 */
class ComposeEnvironmentTest {

	/** {@code @Value("${NAME}")} oder {@code @Value("${NAME:default}")}. */
	private static final Pattern VALUE_ANNOTATION =
			Pattern.compile("@Value\\(\"\\$\\{([A-Z][A-Z0-9_]*)");

	/** Ein Platzhalter in einer yml-Datei, mit oder ohne Vorgabewert. */
	private static final Pattern YAML_PLACEHOLDER =
			Pattern.compile("\\$\\{([A-Z][A-Z0-9_]*)[:}]");

	/**
	 * Ein Eintrag in einem {@code environment}-Block, also eine eingerueckte
	 * Zeile {@code NAME: wert}.
	 *
	 * <p>Verankert und nicht als Teilzeichenkette gesucht. Ein blosses
	 * {@code contains(name + ":")} liesse zwei Wege daran vorbei: ein Name, der
	 * nur in einem Kommentar steht, gaelte als durchgereicht, und ein kuerzerer
	 * Name ginge durch einen laengeren hindurch ({@code ADMIN_EMAIL} findet sich
	 * in {@code BOOTSTRAP_ADMIN_EMAIL}).
	 */
	private static final Pattern ENVIRONMENT_ENTRY =
			Pattern.compile("^\\s{2,}([A-Z][A-Z0-9_]*):(\\s|$)");

	/**
	 * Ein Eintrag in {@code .env.example}, auch auskommentiert.
	 *
	 * <p>Das {@code #} ist zugelassen, weil ein Wert mit sinnvollem Vorgabewert
	 * in der Vorlage sichtbar sein soll, ohne leer gesetzt zu werden: eine leere
	 * Zeile ist etwas anderes als eine fehlende, und Spring setzt seinen
	 * Vorgabewert nur bei der fehlenden ein.
	 */
	private static final Pattern ENV_EXAMPLE_ENTRY =
			Pattern.compile("^#?([A-Z][A-Z0-9_]*)=.*$");

	/**
	 * Umgebungswerte, die bewusst NICHT im Betrieb ankommen sollen, mit der
	 * Klasse, die sie liest.
	 *
	 * <p>Eine Ausnahmeliste ist nur so viel wert wie ihre Begruendung, deshalb
	 * steht hier nicht nur der Name, sondern auch die lesende Klasse: der zweite
	 * Test unten prueft, dass diese Klasse tatsaechlich auf das Profil
	 * {@code dev} beschraenkt ist. Faellt dort einmal {@code @Profile("dev")}
	 * weg, schlaegt der Test fehl und erzwingt eine Entscheidung, statt die
	 * Ausnahme still weitergelten zu lassen.
	 */
	private static final Map<String, String> DEV_PROFILE_ONLY = Map.of(
			"DEV_TEST_PASSWORD", "user/DevTestUserSeeder.java");

	@Test
	@DisplayName("Jeder Umgebungswert, den der Code liest, wird an den Container durchgereicht")
	void everyValueReadByCodeReachesTheContainer() {
		Set<String> read = environmentNamesReadByCode();
		assertThat(read)
				.as("Weder ein @Value noch ein yml-Platzhalter gefunden. Die Muster passen "
						+ "vermutlich nicht mehr, und der Test prueft dann nichts.")
				.isNotEmpty();

		Set<String> passed = new LinkedHashSet<>();
		passed.addAll(environmentNamesIn(TestConfigurationFiles.composeBaseYaml()));
		passed.addAll(environmentNamesIn(TestConfigurationFiles.composeProdYaml()));

		Set<String> missing = new LinkedHashSet<>();
		for (String name : read) {
			if (!DEV_PROFILE_ONLY.containsKey(name) && !passed.contains(name)) {
				missing.add(name);
			}
		}

		assertThat(missing)
				.as("Diese Werte liest der Code, aber die Compose-Dateien reichen sie nicht an "
						+ "den Container durch. Im Profil prod liest niemand die .env, der "
						+ "environment-Block ist der einzige Weg. Die Anwendung wuerde sie "
						+ "stillschweigend als nicht gesetzt behandeln.")
				.isEmpty();
	}

	@Test
	@DisplayName("Die Ausnahmen sind wirklich auf das Profil dev beschraenkt")
	void exceptionsAreProfileDevOnly() {
		for (Map.Entry<String, String> exception : DEV_PROFILE_ONLY.entrySet()) {
			Path source = TestConfigurationFiles.mainJavaSources().stream()
					.filter(path -> path.toString().replace('\\', '/').endsWith(exception.getValue()))
					.findFirst()
					.orElseThrow(() -> new AssertionError(
							"Die Ausnahmeliste nennt " + exception.getValue()
									+ ", diese Datei gibt es aber nicht mehr. Ausnahme pruefen."));

			assertThat(TestConfigurationFiles.contentOf(source))
					.as("%s ist als Ausnahme gefuehrt, weil %s nur im Profil dev laeuft. "
							+ "Faellt diese Beschraenkung weg, muss der Wert in den "
							+ "Compose-Dateien durchgereicht werden.",
							exception.getKey(), exception.getValue())
					.contains("@Profile(\"dev\")");
		}
	}

	@Test
	@DisplayName("Jeder gelesene Umgebungswert steht in .env.example")
	void everyValueReadByCodeIsDocumented() {
		Set<String> read = environmentNamesReadByCode();
		Set<String> documented = new LinkedHashSet<>();
		for (String line : TestConfigurationFiles.effectiveLinesKeepingCommentedEntries(
				TestConfigurationFiles.envExample())) {
			Matcher matcher = ENV_EXAMPLE_ENTRY.matcher(line.trim());
			if (matcher.matches()) {
				documented.add(matcher.group(1));
			}
		}

		Set<String> undocumented = new LinkedHashSet<>(read);
		undocumented.removeAll(documented);

		assertThat(undocumented)
				.as(".env.example ist die einzige Liste, aus der eine neue Umgebung entsteht. "
						+ "Diese Werte liest der Code, ohne dass sie dort stehen.")
				.isEmpty();
	}

	/**
	 * Alle Umgebungsnamen, die der Hauptcode liest, auf beiden Wegen: direkt per
	 * {@code @Value} und ueber die Platzhalter der {@code application*.yml}.
	 */
	private static Set<String> environmentNamesReadByCode() {
		Set<String> names = new LinkedHashSet<>();
		for (Path source : TestConfigurationFiles.mainJavaSources()) {
			Matcher matcher = VALUE_ANNOTATION.matcher(TestConfigurationFiles.contentOf(source));
			while (matcher.find()) {
				names.add(matcher.group(1));
			}
		}
		for (Path yaml : TestConfigurationFiles.applicationYamls()) {
			for (String line : TestConfigurationFiles.effectiveLines(yaml)) {
				Matcher matcher = YAML_PLACEHOLDER.matcher(line);
				while (matcher.find()) {
					names.add(matcher.group(1));
				}
			}
		}
		return names;
	}

	/** Die Namen aller {@code environment}-Eintraege einer Compose-Datei. */
	private static Set<String> environmentNamesIn(Path compose) {
		Set<String> names = new LinkedHashSet<>();
		List<String> lines = TestConfigurationFiles.effectiveLines(compose);
		for (String line : lines) {
			Matcher matcher = ENVIRONMENT_ENTRY.matcher(line);
			if (matcher.find()) {
				names.add(matcher.group(1));
			}
		}
		return names;
	}
}
