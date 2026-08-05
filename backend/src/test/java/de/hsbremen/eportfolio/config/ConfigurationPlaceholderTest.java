package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Haelt {@code .env.example} und die {@code application*.yml} zusammen
 * (KAN-50, API-Contract §6.8).
 *
 * <p>Jeder Platzhalter ohne Default ist ein Pflichtwert: fehlt er in der
 * Umgebung, startet die Anwendung nicht. Steht er dann auch noch nicht in der
 * Vorlage, ist die Fehlermeldung beim Aufsetzen einer neuen Umgebung die
 * einzige Quelle, aus der man ihn erfaehrt, und zwar einen Wert nach dem
 * anderen. Dieser Test sorgt dafuer, dass die Vorlage vollstaendig bleibt,
 * ohne dass jemand daran denken muss.
 */
class ConfigurationPlaceholderTest {

	/** Platzhalter ohne Default-Teil, also {@code ${NAME}} und nicht {@code ${NAME:wert}}. */
	private static final Pattern REQUIRED_PLACEHOLDER = Pattern.compile("\\$\\{([A-Z][A-Z0-9_]*)}");

	/** Eine Zeile der Form {@code NAME=wert} in {@code .env.example}. */
	private static final Pattern ENV_ENTRY = Pattern.compile("^([A-Z][A-Z0-9_]*)=.*$");

	@Test
	@DisplayName("Jeder Pflicht-Platzhalter aus den yml-Dateien steht in .env.example")
	void envExampleIsComplete() {
		Set<String> required = requiredVariables();
		Set<String> documented = documentedVariables();

		assertThat(required)
				.as(".env.example ist die einzige Liste, aus der eine neue Umgebung entsteht")
				.isSubsetOf(documented);
	}

	@Test
	@DisplayName("Die neuen Fremddienst-Schluessel sind in der Vorlage angekommen")
	void newKeysAreDocumented() {
		assertThat(documentedVariables()).contains(
				"AZURE_STORAGE_CONTAINER",
				"AZURE_STORAGE_CONNECTION_STRING",
				"MAIL_FROM_ADDRESS",
				"APP_BASE_URL");
	}

	private static Set<String> requiredVariables() {
		Set<String> names = new LinkedHashSet<>();
		for (Path yaml : TestConfigurationFiles.applicationYamls()) {
			for (String line : TestConfigurationFiles.effectiveLines(yaml)) {
				Matcher matcher = REQUIRED_PLACEHOLDER.matcher(line);
				while (matcher.find()) {
					names.add(matcher.group(1));
				}
			}
		}
		assertThat(names).as("Keine Platzhalter gefunden, der Test liest offenbar nichts").isNotEmpty();
		return names;
	}

	private static Set<String> documentedVariables() {
		List<String> lines = TestConfigurationFiles.effectiveLines(TestConfigurationFiles.envExample());
		Set<String> names = new LinkedHashSet<>();
		for (String line : lines) {
			Matcher matcher = ENV_ENTRY.matcher(line.trim());
			if (matcher.matches()) {
				names.add(matcher.group(1));
			}
		}
		return names;
	}
}
