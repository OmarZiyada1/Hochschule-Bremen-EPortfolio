package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * Findet die eingecheckten Konfigurationsdateien fuer die Tests aus KAN-50.
 *
 * <p>Bewusst ueber den Dateipfad und nicht ueber den Klassenpfad: geprueft wird
 * die Datei, die im Repository liegt und der Thesis beiliegt, nicht ihre Kopie
 * in {@code target/classes}. Fuer die Frage „steht ein Geheimnis im
 * Repository" ist genau das der Unterschied, auf den es ankommt.
 */
final class TestConfigurationFiles {

	private TestConfigurationFiles() {
	}

	/**
	 * Wurzel des Repositories, unabhaengig davon, ob der Testlauf aus
	 * {@code backend/} oder aus dem Projekt-Root gestartet wurde.
	 */
	private static Path repositoryRoot() {
		Path fromModule = Path.of("..").toAbsolutePath().normalize();
		if (Files.isDirectory(fromModule.resolve("backend/src/main/resources"))) {
			return fromModule;
		}
		Path fromRoot = Path.of("").toAbsolutePath().normalize();
		assertThat(fromRoot.resolve("backend/src/main/resources"))
				.as("Konfigurationsverzeichnis nicht gefunden, Arbeitsverzeichnis: " + fromRoot)
				.isDirectory();
		return fromRoot;
	}

	/**
	 * Alle {@code application*.yml} aus {@code backend/src/main/resources},
	 * alphabetisch. Nicht aufgezaehlt, sondern gesucht: ein spaeter angelegtes
	 * {@code application-staging.yml} faellt sonst durch jede Pruefung.
	 */
	static List<Path> applicationYamls() {
		Path resources = repositoryRoot().resolve("backend/src/main/resources");
		try (Stream<Path> files = Files.list(resources)) {
			List<Path> found = files
					.filter(path -> path.getFileName().toString().matches("application.*\\.ya?ml"))
					.sorted(Comparator.comparing(Path::toString))
					.toList();
			assertThat(found)
					.as("Keine application*.yml unter " + resources + " gefunden")
					.isNotEmpty();
			return found;
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** Die eingecheckte Vorlage der Umgebungsvariablen im Projekt-Root. */
	static Path envExample() {
		Path envExample = repositoryRoot().resolve(".env.example");
		assertThat(envExample).as("Vorlage .env.example fehlt").isRegularFile();
		return envExample;
	}

	/**
	 * Zeilen ohne Kommentare und ohne Leerzeilen. Ein abgeschnittener
	 * Zeilenkommentar zaehlt nicht mit: sonst schlaegt ein erlaeuternder Satz
	 * ueber ein Passwort als Passwort an.
	 */
	static List<String> effectiveLines(Path file) {
		try {
			return Files.readAllLines(file, StandardCharsets.UTF_8).stream()
					.map(TestConfigurationFiles::withoutComment)
					.filter(line -> !line.isBlank())
					.toList();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	private static String withoutComment(String line) {
		int hash = line.indexOf('#');
		if (hash < 0) {
			return line;
		}
		// Nur ein Kommentar am Zeilenanfang oder nach Leerraum. Ein '#' mitten
		// im Wert (etwa in einem Passwort) bleibt stehen und wird dadurch
		// weiterhin gefunden.
		if (hash == 0 || Character.isWhitespace(line.charAt(hash - 1))) {
			return line.substring(0, hash);
		}
		return line;
	}
}
