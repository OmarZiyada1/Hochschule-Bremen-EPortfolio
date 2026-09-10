package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Haelt den Java-Code und {@code compose.prod.yml} zusammen (KAN-99).
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
 * Umgebung des Prozesses, und die Compose-Datei ist der einzige Weg dorthin.
 * Die {@code .env} im Projektverzeichnis benutzt Compose nur, um Platzhalter in
 * der Compose-Datei zu ersetzen, nicht um den Container zu befuellen.
 *
 * <p>Der Test prueft deshalb genau eine Richtung: <strong>was der Code liest,
 * muss im Betrieb ankommen koennen.</strong>
 */
class ComposeEnvironmentTest {

	/** {@code @Value("${NAME}")} oder {@code @Value("${NAME:default}")}. */
	private static final Pattern VALUE_ANNOTATION =
			Pattern.compile("@Value\\(\"\\$\\{([A-Z][A-Z0-9_]*)");

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
	private static final Map<String, String> NUR_IM_PROFIL_DEV = Map.of(
			"DEV_TEST_PASSWORD", "user/DevTestUserSeeder.java");

	@Test
	@DisplayName("Jeder per @Value gelesene Umgebungswert wird in compose.prod.yml durchgereicht")
	void everyValueAnnotationReachesTheContainer() {
		Set<String> gelesen = environmentNamesReadByCode();
		assertThat(gelesen)
				.as("Kein einziges @Value auf eine Umgebungsvariable gefunden. Das Muster passt "
						+ "vermutlich nicht mehr, und der Test prueft dann nichts.")
				.isNotEmpty();

		String compose = TestConfigurationFiles.contentOf(TestConfigurationFiles.composeProdYaml());

		Set<String> fehlend = new LinkedHashSet<>();
		for (String name : gelesen) {
			if (NUR_IM_PROFIL_DEV.containsKey(name)) {
				continue;
			}
			if (!compose.contains(name + ":")) {
				fehlend.add(name);
			}
		}

		assertThat(fehlend)
				.as("Diese Werte liest der Code, aber compose.prod.yml reicht sie nicht an den "
						+ "Container durch. Im Profil prod liest niemand die .env, der "
						+ "environment-Block ist der einzige Weg. Die Anwendung wuerde sie "
						+ "stillschweigend als nicht gesetzt behandeln.")
				.isEmpty();
	}

	@Test
	@DisplayName("Die Ausnahmen sind wirklich auf das Profil dev beschraenkt")
	void exceptionsAreProfileDevOnly() {
		for (Map.Entry<String, String> ausnahme : NUR_IM_PROFIL_DEV.entrySet()) {
			Path quelle = TestConfigurationFiles.mainJavaSources().stream()
					.filter(path -> path.toString().replace('\\', '/').endsWith(ausnahme.getValue()))
					.findFirst()
					.orElseThrow(() -> new AssertionError(
							"Die Ausnahmeliste nennt " + ausnahme.getValue()
									+ ", diese Datei gibt es aber nicht mehr. Ausnahme pruefen."));

			assertThat(TestConfigurationFiles.contentOf(quelle))
					.as("%s ist als Ausnahme gefuehrt, weil %s nur im Profil dev laeuft. "
							+ "Faellt diese Beschraenkung weg, muss der Wert in compose.prod.yml "
							+ "durchgereicht werden.", ausnahme.getKey(), ausnahme.getValue())
					.contains("@Profile(\"dev\")");
		}
	}

	@Test
	@DisplayName("Die durchgereichten Werte stehen auch in .env.example")
	void everyPassedValueIsDocumented() {
		Set<String> gelesen = environmentNamesReadByCode();
		String vorlage = TestConfigurationFiles.contentOf(TestConfigurationFiles.envExample());

		Set<String> undokumentiert = new LinkedHashSet<>();
		for (String name : gelesen) {
			if (!vorlage.contains(name + "=")) {
				undokumentiert.add(name);
			}
		}

		assertThat(undokumentiert)
				.as(".env.example ist die einzige Liste, aus der eine neue Umgebung entsteht. "
						+ "Diese Werte liest der Code, ohne dass sie dort stehen.")
				.isEmpty();
	}

	/** Alle Umgebungsnamen, die der Hauptcode per {@code @Value} liest. */
	private static Set<String> environmentNamesReadByCode() {
		Set<String> namen = new LinkedHashSet<>();
		for (Path quelle : TestConfigurationFiles.mainJavaSources()) {
			Matcher matcher = VALUE_ANNOTATION.matcher(TestConfigurationFiles.contentOf(quelle));
			while (matcher.find()) {
				namen.add(matcher.group(1));
			}
		}
		return namen;
	}
}
