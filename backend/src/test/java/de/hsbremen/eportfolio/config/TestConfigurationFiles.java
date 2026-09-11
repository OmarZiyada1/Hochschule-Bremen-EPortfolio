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
	 * Das Overlay der Betriebsart PROD (KAN-99).
	 *
	 * <p>Gebraucht, weil im Profil {@code prod} niemand die {@code .env} liest:
	 * {@code application-prod.yml} verzichtet bewusst auf
	 * {@code spring.config.import}, und Compose benutzt die Datei nur, um
	 * Platzhalter in der Compose-Datei selbst zu ersetzen. Ein Wert erreicht die
	 * Anwendung im Betrieb also ausschliesslich ueber den
	 * {@code environment}-Block dieser Datei.
	 */
	static Path composeProdYaml() {
		Path compose = repositoryRoot().resolve("compose.prod.yml");
		assertThat(compose).as("compose.prod.yml fehlt").isRegularFile();
		return compose;
	}

	/**
	 * Die Basis der Compose-Dateien (KAN-99).
	 *
	 * <p>Gebraucht neben dem Overlay, weil die Umgebung des Containers aus
	 * beiden Dateien zusammen entsteht: {@code JWT_SECRET} und die
	 * {@code POSTGRES_}-Werte stehen ausschliesslich hier.
	 */
	static Path composeBaseYaml() {
		Path compose = repositoryRoot().resolve("compose.base.yml");
		assertThat(compose).as("compose.base.yml fehlt").isRegularFile();
		return compose;
	}

	/**
	 * Wie {@link #effectiveLines(Path)}, aber ein auskommentierter Eintrag der
	 * Form {@code #NAME=} bleibt erhalten.
	 *
	 * <p>Fuer {@code .env.example}: ein Wert mit sinnvollem Vorgabewert soll in
	 * der Vorlage sichtbar sein, ohne leer gesetzt zu werden. Eine leere Zeile
	 * {@code NAME=} ist etwas anderes als eine fehlende, denn Spring setzt
	 * seinen Vorgabewert nur bei der fehlenden ein. Erhaltungswuerdig ist
	 * ausschliesslich diese Form; ein erlaeuternder Satz mit einem
	 * Gleichheitszeichen faellt weiterhin weg.
	 */
	static List<String> effectiveLinesKeepingCommentedEntries(Path file) {
		try {
			return Files.readAllLines(file, StandardCharsets.UTF_8).stream()
					.map(line -> line.matches("^\\s*#[A-Z][A-Z0-9_]*=.*$")
							? line.trim()
							: withoutComment(line))
					.filter(line -> !line.isBlank())
					.toList();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** Alle Java-Quelldateien des Hauptcodes. */
	static List<Path> mainJavaSources() {
		Path java = repositoryRoot().resolve("backend/src/main/java");
		try (Stream<Path> files = Files.walk(java)) {
			List<Path> found = files
					.filter(path -> path.getFileName().toString().endsWith(".java"))
					.sorted(Comparator.comparing(Path::toString))
					.toList();
			assertThat(found).as("Keine Java-Quellen unter " + java).isNotEmpty();
			return found;
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** Der vollstaendige Inhalt einer Datei, Kommentare eingeschlossen. */
	static String contentOf(Path file) {
		try {
			return Files.readString(file, StandardCharsets.UTF_8);
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
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
