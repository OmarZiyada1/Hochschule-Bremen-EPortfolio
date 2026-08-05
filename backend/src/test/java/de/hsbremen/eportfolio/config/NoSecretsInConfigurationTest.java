package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Haelt fest, dass in keiner eingecheckten {@code application*.yml} ein Wert
 * steht, der wie ein Geheimnis aussieht (KAN-50, API-Contract §6.8).
 *
 * <p><strong>Warum als Test und nicht als Regel in der Doku.</strong> Ein
 * Zugangsdatum landet nicht mit Absicht im Repository, sondern beim schnellen
 * Ausprobieren („nur bis das laeuft"). Eine Doku-Zeile faellt dabei nicht auf,
 * ein roter Test schon. Und ist der Wert einmal eingecheckt, hilft auch
 * Loeschen nicht mehr: er steht in der Historie, die der Thesis beiliegt.
 *
 * <p>Der Test macht eine schmale, dafuer verlaessliche Aussage: bei einem
 * Schluessel, dessen Name auf ein Geheimnis hindeutet, ist ausschliesslich ein
 * Platzhalter ohne Default erlaubt. Ein Default waere die eigentliche Falle,
 * denn {@code ${JWT_SECRET:geheim}} sieht auf den ersten Blick genauso richtig
 * aus wie {@code ${JWT_SECRET}} und traegt trotzdem einen fest verdrahteten
 * Wert.
 */
class NoSecretsInConfigurationTest {

	/**
	 * Namensbestandteile, die einen Wert zum Geheimnis machen. Gemeint ist der
	 * letzte Schluesselteil, also {@code secret} in {@code app.security.jwt.secret}.
	 */
	private static final List<String> SENSITIVE_NAMES = List.of(
			"secret", "password", "key", "token", "credential", "connection-string");

	/** Eine YAML-Zeile der Form {@code   schluessel: wert}. */
	private static final Pattern ENTRY = Pattern.compile("^\\s*([A-Za-z0-9_.-]+)\\s*:\\s*(\\S.*)$");

	/** Erlaubter Wert: ein Platzhalter ohne Default-Teil. */
	private static final Pattern PLACEHOLDER_WITHOUT_DEFAULT = Pattern.compile("^\\$\\{[A-Z][A-Z0-9_]*}$");

	@Test
	@DisplayName("Kein Geheimnis in einer eingecheckten application*.yml")
	void noSecretsInYaml() {
		List<String> findings = new ArrayList<>();

		for (Path yaml : TestConfigurationFiles.applicationYamls()) {
			List<String> lines = TestConfigurationFiles.effectiveLines(yaml);
			for (String line : lines) {
				Matcher matcher = ENTRY.matcher(line);
				if (!matcher.matches()) {
					continue;
				}
				String key = matcher.group(1);
				String value = matcher.group(2).trim();
				if (!isSensitive(key) || PLACEHOLDER_WITHOUT_DEFAULT.matcher(value).matches()) {
					continue;
				}
				// Der beanstandete Wert wird bewusst nicht mit ausgegeben: er
				// stuende sonst im Testprotokoll und damit womoeglich in einem
				// CI-Log.
				findings.add("%s: Schluessel '%s' traegt einen Wert statt eines Platzhalters ${…}"
						.formatted(yaml.getFileName(), key));
			}
		}

		assertThat(findings)
				.as("Geheimnisse gehoeren ausschliesslich in die Umgebung (§6.8)")
				.isEmpty();
	}

	@Test
	@DisplayName("Der Geheimnis-Scan sieht die geprueften Dateien wirklich")
	void scanReachesTheFiles() {
		// Ohne diese Zusicherung waere ein Test, der nichts findet, weil er
		// nichts liest, nicht von einem sauberen Ergebnis zu unterscheiden.
		assertThat(TestConfigurationFiles.applicationYamls())
				.extracting(path -> path.getFileName().toString())
				.contains("application.yml", "application-dev.yml", "application-prod.yml");
	}

	private static boolean isSensitive(String key) {
		String lastSegment = key.substring(key.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
		return SENSITIVE_NAMES.stream().anyMatch(lastSegment::contains);
	}
}
