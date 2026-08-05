package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Haelt die Falle fest, die dieses Ticket beim Ausprobieren zutage gefoerdert
 * hat: ein Platzhalter ohne Default in der yml ist <strong>kein</strong>
 * Fail-Fast-Netz.
 *
 * <p>Springs {@code Binder} loest Platzhalter mit
 * {@code ignoreUnresolvablePlaceholders = true} auf. Fehlt die
 * Umgebungsvariable, scheitert die Bindung also nicht, sondern der Wert wird zur
 * Zeichenfolge {@code ${AZURE_STORAGE_CONTAINER}}. Vor der Pruefung aus
 * {@link ConfigurationValues} startete die Anwendung im Profil prod damit
 * anstandslos und schrieb ins Startprotokoll
 * {@code Container=${AZURE_STORAGE_CONTAINER}}.
 *
 * <p>Ein {@code @NotBlank} haette das nie gefunden: die Zeichenfolge ist nicht
 * leer. Deshalb steht der Fall hier als eigener Test und nicht als Randnotiz in
 * den Tests der einzelnen Records.
 */
class UnresolvedPlaceholderTest {

	private static final String UNRESOLVED = "${AZURE_STORAGE_CONTAINER}";

	@Nested
	@DisplayName("ConfigurationValues.isMissing")
	class IsMissing {

		@Test
		@DisplayName("Nicht gesetzt, leer und Platzhalter zaehlen alle als fehlend")
		void missingValues() {
			assertThat(ConfigurationValues.isMissing(null)).isTrue();
			assertThat(ConfigurationValues.isMissing("")).isTrue();
			assertThat(ConfigurationValues.isMissing("   ")).isTrue();
			assertThat(ConfigurationValues.isMissing(UNRESOLVED)).isTrue();
		}

		@Test
		@DisplayName("Ein Platzhalter mitten im Wert zaehlt ebenfalls als fehlend")
		void placeholderInsideValue() {
			// https://${APP_HOST}/portfolio ist als Basis-URL genauso unbrauchbar
			// wie gar keine.
			assertThat(ConfigurationValues.isMissing("https://${APP_HOST}/portfolio")).isTrue();
		}

		@Test
		@DisplayName("Echte Werte bleiben unbeanstandet, auch mit Sonderzeichen")
		void realValues() {
			assertThat(ConfigurationValues.isMissing("eportfolio-files")).isFalse();
			assertThat(ConfigurationValues.isMissing("https://portfolio.hs-bremen.de")).isFalse();
			// Ein Dollarzeichen allein macht noch keinen Platzhalter: es kommt in
			// erzeugten Passwoertern und Schluesseln vor.
			assertThat(ConfigurationValues.isMissing("aB$3xy/+geheim")).isFalse();
		}
	}

	@Test
	@DisplayName("Speicher: Platzhalter statt Container laesst den Start scheitern")
	void storageRejectsPlaceholder() {
		assertThatThrownBy(() -> new StorageProperties(
				StorageProvider.AZURE, UNRESOLVED, "AccountName=x;AccountKey=y", null, null))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("app.storage.container")
				.hasMessageContaining("AZURE_STORAGE_CONTAINER");
	}

	@Test
	@DisplayName("Mail: Platzhalter statt Basis-URL laesst den Start scheitern")
	void mailRejectsPlaceholder() {
		assertThatThrownBy(() -> new MailProperties(
				MailProvider.SMTP, "noreply@eportfolio.invalid", "E-Portfolio", "${APP_BASE_URL}"))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("app.mail.base-url")
				.hasMessageContaining("APP_BASE_URL");
	}

	@Test
	@DisplayName("JWT: Platzhalter statt Secret laesst den Start scheitern")
	void jwtRejectsPlaceholder() {
		// Bisher fiel dieser Fall nur zufaellig auf, weil "${JWT_SECRET}" fuer
		// HS512 zu kurz ist. Ein laengerer Variablenname haette gereicht, um an
		// der Pruefung im JwtService vorbeizukommen.
		assertThatThrownBy(() -> new JwtProperties("${JWT_SECRET}", Duration.ofHours(8), "eportfolio"))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("JWT_SECRET");
	}

	@Test
	@DisplayName("CORS: Platzhalter statt Herkunftsliste laesst den Start scheitern")
	void corsRejectsPlaceholder() {
		assertThatThrownBy(() -> new CorsProperties(List.of("${CORS_ALLOWED_ORIGINS}")))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("CORS_ALLOWED_ORIGINS");
	}

	@Test
	@DisplayName("Gesetzte Werte kommen unveraendert durch")
	void resolvedValuesPass() {
		assertThatCode(() -> {
			new StorageProperties(StorageProvider.AZURE, "eportfolio-files",
					"DefaultEndpointsProtocol=https;AccountName=x;AccountKey=y", null, null);
			new MailProperties(MailProvider.SMTP, "noreply@hs-bremen.de", "E-Portfolio",
					"https://portfolio.hs-bremen.de");
			new JwtProperties("a".repeat(88), Duration.ofHours(8), "eportfolio");
			new CorsProperties(List.of("https://portfolio.hs-bremen.de"));
		}).doesNotThrowAnyException();
	}
}
