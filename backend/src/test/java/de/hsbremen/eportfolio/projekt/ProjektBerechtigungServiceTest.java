package de.hsbremen.eportfolio.projekt;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.auth.AngemeldeterBenutzer;
import de.hsbremen.eportfolio.benutzer.TestUser;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Prueft die Rechtematrix aus API-Contract §5 Zeile fuer Zeile, je Rolle,
 * einschliesslich der Statusregeln aus §4.1.
 *
 * <p>{@code null} als Benutzer steht fuer PUBLIC (§2.1).
 */
class ProjektBerechtigungServiceTest {

	private ProjektBerechtigungService service;

	private User autorUser;

	private AngemeldeterBenutzer autor;

	private AngemeldeterBenutzer fremderStudi;

	private AngemeldeterBenutzer redakteur;

	private AngemeldeterBenutzer fremderRedakteur;

	private AngemeldeterBenutzer admin;

	private User redakteurUser;

	private static final AngemeldeterBenutzer PUBLIC = null;

	@BeforeEach
	void setUp() {
		service = mitEigenschaften(true, false);

		autorUser = TestUser.aktiv(Rolle.STUDIERENDE, "hash");
		autor = AngemeldeterBenutzer.aus(autorUser);

		fremderStudi = AngemeldeterBenutzer.aus(TestUser.aktiv(Rolle.STUDIERENDE, "hash"));

		redakteurUser = TestUser.aktiv(Rolle.REDAKTEUR, "hash");
		redakteur = AngemeldeterBenutzer.aus(redakteurUser);

		fremderRedakteur = AngemeldeterBenutzer.aus(TestUser.aktiv(Rolle.REDAKTEUR, "hash"));
		admin = AngemeldeterBenutzer.aus(TestUser.aktiv(Rolle.ADMIN, "hash"));
	}

	private static ProjektBerechtigungService mitEigenschaften(boolean vierAugen, boolean adminDarfInhalt) {
		return new ProjektBerechtigungService(new BerechtigungEigenschaften(vierAugen, adminDarfInhalt));
	}

	/** Projekt des Autors, mit {@code redakteurUser} als betreuender Redaktion. */
	private Projekt projekt(ProjektStatus status) {
		return TestProjekt.mitRedakteur(TestProjekt.mitAutor(autorUser, status), redakteurUser);
	}

	// ------------------------------------------------------------------

	@Nested
	@DisplayName("Zeile: Projekte lesen")
	class Lesen {

		@Test
		@DisplayName("Veroeffentlichte Projekte darf jede Rolle lesen, auch PUBLIC")
		void veroeffentlichteLesen() {
			Projekt p = projekt(ProjektStatus.VEROEFFENTLICHT);

			assertThat(service.darfProjektLesen(PUBLIC, p)).isTrue();
			assertThat(service.darfProjektLesen(fremderStudi, p)).isTrue();
			assertThat(service.darfProjektLesen(redakteur, p)).isTrue();
			assertThat(service.darfProjektLesen(admin, p)).isTrue();
		}

		@Test
		@DisplayName("Nicht veroeffentlicht: PUBLIC nein, Fremde nein, eigene ja, Redaktion und Admin ja")
		void nichtVeroeffentlichteLesen() {
			Projekt p = projekt(ProjektStatus.ENTWURF);

			assertThat(service.darfProjektLesen(PUBLIC, p)).isFalse();
			assertThat(service.darfProjektLesen(fremderStudi, p)).isFalse();
			assertThat(service.darfProjektLesen(autor, p)).isTrue();
			assertThat(service.darfProjektLesen(fremderRedakteur, p)).isTrue();
			assertThat(service.darfProjektLesen(admin, p)).isTrue();
		}

		@Test
		@DisplayName("Projektmitglieder duerfen den Entwurf lesen (§3.13)")
		void mitgliedDarfLesen() {
			User mitgliedUser = TestUser.aktiv(Rolle.STUDIERENDE, "hash");
			Projekt p = TestProjekt.mitMitglied(projekt(ProjektStatus.ENTWURF), mitgliedUser);

			assertThat(service.darfProjektLesen(AngemeldeterBenutzer.aus(mitgliedUser), p)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeile: Projekt anlegen")
	class Anlegen {

		@Test
		@DisplayName("PUBLIC nein, alle angemeldeten Rollen ja")
		void anlegen() {
			assertThat(service.darfProjektAnlegen(PUBLIC)).isFalse();
			assertThat(service.darfProjektAnlegen(fremderStudi)).isTrue();
			assertThat(service.darfProjektAnlegen(redakteur)).isTrue();
			assertThat(service.darfProjektAnlegen(admin)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeile: Projekt-Inhalt bearbeiten")
	class InhaltBearbeiten {

		@Test
		@DisplayName("Autor:in ja, Projektmitglied ja, fremde:r Studierende:r nein")
		void projektseite() {
			User mitgliedUser = TestUser.aktiv(Rolle.STUDIERENDE, "hash");
			Projekt p = TestProjekt.mitMitglied(projekt(ProjektStatus.ENTWURF), mitgliedUser);

			assertThat(service.darfInhaltBearbeiten(autor, p)).isTrue();
			assertThat(service.darfInhaltBearbeiten(AngemeldeterBenutzer.aus(mitgliedUser), p)).isTrue();
			assertThat(service.darfInhaltBearbeiten(fremderStudi, p)).isFalse();
			assertThat(service.darfInhaltBearbeiten(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Redakteur:in nur beim zugewiesenen Projekt ((✓) = eigene Ressource)")
		void nurZugewieseneRedaktion() {
			Projekt p = projekt(ProjektStatus.UEBERARBEITUNG);

			assertThat(service.darfInhaltBearbeiten(redakteur, p)).isTrue();
			assertThat(service.darfInhaltBearbeiten(fremderRedakteur, p)).isFalse();
		}

		@ParameterizedTest
		@EnumSource(value = ProjektStatus.class,
				names = {"EINGEREICHT", "GENEHMIGT", "VEROEFFENTLICHT"})
		@DisplayName("In gesperrten Status darf niemand den Inhalt aendern (§4.1)")
		void gesperrteStatus(ProjektStatus status) {
			Projekt p = projekt(status);

			assertThat(service.darfInhaltBearbeiten(autor, p)).isFalse();
			assertThat(service.darfInhaltBearbeiten(redakteur, p)).isFalse();
			assertThat(service.darfInhaltBearbeiten(admin, p)).isFalse();
		}

		@Test
		@DisplayName("Default (OF 2): Admin bearbeitet fremde Inhalte nicht")
		void adminDefaultNurLesend() {
			Projekt p = projekt(ProjektStatus.ENTWURF);

			assertThat(service.darfInhaltBearbeiten(admin, p)).isFalse();
		}

		@Test
		@DisplayName("Mit umgelegter Property darf der Admin fremde Inhalte bearbeiten")
		void adminMitSchalter() {
			ProjektBerechtigungService mitAdminZugriff = mitEigenschaften(true, true);
			Projekt p = projekt(ProjektStatus.ENTWURF);

			assertThat(mitAdminZugriff.darfInhaltBearbeiten(admin, p)).isTrue();
		}

		@Test
		@DisplayName("Ein Admin, der selbst Autor:in ist, darf unabhaengig von der Property")
		void adminAlsAutor() {
			User adminUser = TestUser.aktiv(Rolle.ADMIN, "hash");
			Projekt p = TestProjekt.mitAutor(adminUser, ProjektStatus.ENTWURF);

			assertThat(service.darfInhaltBearbeiten(AngemeldeterBenutzer.aus(adminUser), p)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeile: Projekt einreichen")
	class Einreichen {

		@Test
		@DisplayName("Autor:in ja, Redaktion und Admin nein")
		void einreichen() {
			Projekt p = projekt(ProjektStatus.ENTWURF);

			assertThat(service.darfEinreichen(autor, p)).isTrue();
			assertThat(service.darfEinreichen(fremderStudi, p)).isFalse();
			assertThat(service.darfEinreichen(PUBLIC, p)).isFalse();
			// Matrix: ADMIN ausdruecklich ✗.
			assertThat(service.darfEinreichen(admin, p)).isFalse();
		}

		@Test
		@DisplayName("Auch aus UEBERARBEITUNG heraus (§4.1)")
		void erneutEinreichen() {
			assertThat(service.darfEinreichen(autor, projekt(ProjektStatus.UEBERARBEITUNG))).isTrue();
		}

		@Test
		@DisplayName("Nicht aus einem bereits eingereichten Projekt heraus")
		void keinDoppeltesEinreichen() {
			assertThat(service.darfEinreichen(autor, projekt(ProjektStatus.EINGEREICHT))).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeile: Genehmigen und Veroeffentlichen (inkl. Vier-Augen-Prinzip)")
	class RedaktionelleEntscheidung {

		@Test
		@DisplayName("Genehmigen: Redaktion und Admin ja, Studierende nein, PUBLIC nein")
		void genehmigen() {
			Projekt p = projekt(ProjektStatus.EINGEREICHT);

			assertThat(service.darfGenehmigen(redakteur, p)).isTrue();
			assertThat(service.darfGenehmigen(admin, p)).isTrue();
			assertThat(service.darfGenehmigen(autor, p)).isFalse();
			assertThat(service.darfGenehmigen(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Genehmigen nur aus EINGEREICHT heraus (§4.1)")
		void genehmigenNurAusEingereicht() {
			assertThat(service.darfGenehmigen(redakteur, projekt(ProjektStatus.ENTWURF))).isFalse();
			assertThat(service.darfGenehmigen(redakteur, projekt(ProjektStatus.GENEHMIGT))).isFalse();
		}

		@Test
		@DisplayName("Veroeffentlichen nur aus GENEHMIGT heraus")
		void veroeffentlichen() {
			assertThat(service.darfVeroeffentlichen(redakteur, projekt(ProjektStatus.GENEHMIGT))).isTrue();
			assertThat(service.darfVeroeffentlichen(admin, projekt(ProjektStatus.GENEHMIGT))).isTrue();
			assertThat(service.darfVeroeffentlichen(redakteur, projekt(ProjektStatus.EINGEREICHT))).isFalse();
		}

		@Test
		@DisplayName("Vier-Augen-Prinzip: Redakteur:in genehmigt das eigene Projekt nicht (OF 1)")
		void vierAugenGenehmigen() {
			Projekt eigenes = TestProjekt.mitAutor(redakteurUser, ProjektStatus.EINGEREICHT);

			assertThat(service.darfGenehmigen(redakteur, eigenes)).isFalse();
			// Ein:e andere:r Redakteur:in darf sehr wohl.
			assertThat(service.darfGenehmigen(fremderRedakteur, eigenes)).isTrue();
		}

		@Test
		@DisplayName("Vier-Augen-Prinzip greift auch beim Veroeffentlichen")
		void vierAugenVeroeffentlichen() {
			Projekt eigenes = TestProjekt.mitAutor(redakteurUser, ProjektStatus.GENEHMIGT);

			assertThat(service.darfVeroeffentlichen(redakteur, eigenes)).isFalse();
		}

		@Test
		@DisplayName("Abgeschaltetes Vier-Augen-Prinzip erlaubt die eigene Freigabe")
		void vierAugenAbschaltbar() {
			ProjektBerechtigungService ohneVierAugen = mitEigenschaften(false, false);
			Projekt eigenes = TestProjekt.mitAutor(redakteurUser, ProjektStatus.EINGEREICHT);

			assertThat(ohneVierAugen.darfGenehmigen(redakteur, eigenes)).isTrue();
		}

		@Test
		@DisplayName("Fussnote ¹ steht nur an den REDAKTEUR-Zellen: der Admin ist nicht gesperrt")
		void adminNichtVomVierAugenPrinzipBetroffen() {
			User adminUser = TestUser.aktiv(Rolle.ADMIN, "hash");
			Projekt eigenes = TestProjekt.mitAutor(adminUser, ProjektStatus.EINGEREICHT);

			assertThat(service.darfGenehmigen(AngemeldeterBenutzer.aus(adminUser), eigenes)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeile: Zur Ueberarbeitung zurueckgeben")
	class Zurueckgeben {

		@ParameterizedTest
		@EnumSource(value = ProjektStatus.class,
				names = {"EINGEREICHT", "GENEHMIGT", "VEROEFFENTLICHT"})
		@DisplayName("Redaktion und Admin ja, Studierende nein")
		void zurueckgeben(ProjektStatus status) {
			Projekt p = projekt(status);

			assertThat(service.darfZurueckgeben(redakteur, p)).isTrue();
			assertThat(service.darfZurueckgeben(admin, p)).isTrue();
			assertThat(service.darfZurueckgeben(autor, p)).isFalse();
			assertThat(service.darfZurueckgeben(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Aus ENTWURF heraus gibt es nichts zurueckzugeben")
		void nichtAusEntwurf() {
			assertThat(service.darfZurueckgeben(redakteur, projekt(ProjektStatus.ENTWURF))).isFalse();
		}

		@Test
		@DisplayName("Kein Vier-Augen-Prinzip: hier traegt die Matrix keine Fussnote ¹")
		void ohneVierAugen() {
			Projekt eigenes = TestProjekt.mitAutor(redakteurUser, ProjektStatus.EINGEREICHT);

			assertThat(service.darfZurueckgeben(redakteur, eigenes)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeilen: Kommentare (§2.3, §2.4)")
	class Kommentare {

		@Test
		@DisplayName("ANTWORT: Projektseite ja, Redaktion und Admin ja, fremde:r Studierende:r nein")
		void antwort() {
			Projekt p = projekt(ProjektStatus.EINGEREICHT);

			assertThat(service.darfAntwortKommentarErstellen(autor, p)).isTrue();
			assertThat(service.darfAntwortKommentarErstellen(redakteur, p)).isTrue();
			assertThat(service.darfAntwortKommentarErstellen(admin, p)).isTrue();
			assertThat(service.darfAntwortKommentarErstellen(fremderStudi, p)).isFalse();
			assertThat(service.darfAntwortKommentarErstellen(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("NOTIZ: nur Redaktion und Admin - fuer Studierende unsichtbar")
		void notiz() {
			assertThat(service.darfNotizVerwenden(redakteur)).isTrue();
			assertThat(service.darfNotizVerwenden(admin)).isTrue();
			assertThat(service.darfNotizVerwenden(autor)).isFalse();
			assertThat(service.darfNotizVerwenden(PUBLIC)).isFalse();
		}

		@Test
		@DisplayName("AENDERUNG erstellen: nur Redaktion und Admin")
		void aenderungErstellen() {
			assertThat(service.darfAenderungKommentarErstellen(redakteur)).isTrue();
			assertThat(service.darfAenderungKommentarErstellen(admin)).isTrue();
			assertThat(service.darfAenderungKommentarErstellen(autor)).isFalse();
		}

		@Test
		@DisplayName("AENDERUNG-Status: die Projektseite schaltet um (Fussnote ²)")
		void aenderungStatus() {
			User mitgliedUser = TestUser.aktiv(Rolle.STUDIERENDE, "hash");
			Projekt p = TestProjekt.mitMitglied(projekt(ProjektStatus.UEBERARBEITUNG), mitgliedUser);

			assertThat(service.darfAenderungStatusSetzen(autor, p)).isTrue();
			assertThat(service.darfAenderungStatusSetzen(AngemeldeterBenutzer.aus(mitgliedUser), p)).isTrue();
			assertThat(service.darfAenderungStatusSetzen(redakteur, p)).isTrue();
			assertThat(service.darfAenderungStatusSetzen(fremderStudi, p)).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeilen: Dateien, Reaktionen, Portfolio")
	class Weitere {

		@Test
		@DisplayName("Datei hochladen: Projektseite (✓), zugewiesene Redaktion (✓), Admin ✓")
		void dateiHochladen() {
			Projekt p = projekt(ProjektStatus.ENTWURF);

			assertThat(service.darfDateiHochladen(autor, p)).isTrue();
			assertThat(service.darfDateiHochladen(redakteur, p)).isTrue();
			assertThat(service.darfDateiHochladen(fremderRedakteur, p)).isFalse();
			assertThat(service.darfDateiHochladen(admin, p)).isTrue();
			assertThat(service.darfDateiHochladen(fremderStudi, p)).isFalse();
			assertThat(service.darfDateiHochladen(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Datei lesen: PUBLIC nur bei veroeffentlichtem Projekt (Fussnote ⁴)")
		void dateiLesen() {
			assertThat(service.darfDateiLesen(PUBLIC, projekt(ProjektStatus.VEROEFFENTLICHT))).isTrue();
			assertThat(service.darfDateiLesen(PUBLIC, projekt(ProjektStatus.ENTWURF))).isFalse();
		}

		@Test
		@DisplayName("Reaktion: angemeldet ja, PUBLIC nein, und nur auf Veroeffentlichtes")
		void reaktion() {
			assertThat(service.darfReagieren(fremderStudi, projekt(ProjektStatus.VEROEFFENTLICHT))).isTrue();
			assertThat(service.darfReagieren(admin, projekt(ProjektStatus.VEROEFFENTLICHT))).isTrue();
			assertThat(service.darfReagieren(PUBLIC, projekt(ProjektStatus.VEROEFFENTLICHT))).isFalse();
			assertThat(service.darfReagieren(fremderStudi, projekt(ProjektStatus.ENTWURF))).isFalse();
		}

		@Test
		@DisplayName("Portfolio: jede Rolle nur das eigene")
		void portfolio() {
			assertThat(service.darfPortfolioBearbeiten(autor, autor.getId())).isTrue();
			assertThat(service.darfPortfolioBearbeiten(autor, UUID.randomUUID())).isFalse();
			// Auch der Admin bearbeitet in der Matrix nur (✓) - das eigene.
			assertThat(service.darfPortfolioBearbeiten(admin, autor.getId())).isFalse();
			assertThat(service.darfPortfolioBearbeiten(PUBLIC, autor.getId())).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeilen: Zuweisung, Top-10, Administration")
	class Administration {

		@Test
		@DisplayName("Redakteur:innen zuweisen: Admin ✓, Autor:in im Entwurf (✓)³, REDAKTEUR ✗")
		void redakteureZuweisen() {
			Projekt entwurf = projekt(ProjektStatus.ENTWURF);

			assertThat(service.darfRedakteureZuweisen(admin, entwurf)).isTrue();
			assertThat(service.darfRedakteureZuweisen(autor, entwurf)).isTrue();
			assertThat(service.darfRedakteureZuweisen(redakteur, entwurf)).isFalse();
			assertThat(service.darfRedakteureZuweisen(fremderStudi, entwurf)).isFalse();
			// Nach dem Einreichen verteilt nur noch der Admin um.
			assertThat(service.darfRedakteureZuweisen(autor, projekt(ProjektStatus.EINGEREICHT))).isFalse();
			assertThat(service.darfRedakteureZuweisen(admin, projekt(ProjektStatus.EINGEREICHT))).isTrue();
		}

		@Test
		@DisplayName("Top-10 nominieren: Redaktion und Admin")
		void nominieren() {
			assertThat(service.darfNominieren(redakteur)).isTrue();
			assertThat(service.darfNominieren(admin)).isTrue();
			assertThat(service.darfNominieren(autor)).isFalse();
			assertThat(service.darfNominieren(PUBLIC)).isFalse();
		}

		@Test
		@DisplayName("Top-10 kuratieren, User verwalten, Stammdaten, Dashboard: nur Admin")
		void nurAdmin() {
			assertThat(service.darfTop10Kuratieren(admin)).isTrue();
			assertThat(service.darfTop10Kuratieren(redakteur)).isFalse();

			assertThat(service.darfUserVerwalten(admin)).isTrue();
			assertThat(service.darfUserVerwalten(redakteur)).isFalse();
			assertThat(service.darfUserVerwalten(autor)).isFalse();

			assertThat(service.darfStammdatenVerwalten(admin)).isTrue();
			assertThat(service.darfStammdatenVerwalten(redakteur)).isFalse();

			assertThat(service.darfAdminDashboardSehen(admin)).isTrue();
			assertThat(service.darfAdminDashboardSehen(redakteur)).isFalse();
			assertThat(service.darfAdminDashboardSehen(PUBLIC)).isFalse();
		}
	}

	@Nested
	@DisplayName("Voraussetzung: status = AKTIV (§2.9)")
	class NurAktiveKonten {

		@ParameterizedTest
		@EnumSource(value = UserStatus.class, names = {"REGISTRIERUNG_OFFEN", "DEAKTIVIERT"})
		@DisplayName("Ein nicht aktives Konto hat nur PUBLIC-Rechte")
		void nichtAktiveKonten(UserStatus status) {
			User gesperrterAdmin = TestUser.erzeuge(UUID.randomUUID(), "gesperrt@example.org",
					"gesperrt@hs-bremen.de", Rolle.ADMIN, status, "hash");
			AngemeldeterBenutzer benutzer = AngemeldeterBenutzer.aus(gesperrterAdmin);
			Projekt p = projekt(ProjektStatus.EINGEREICHT);

			assertThat(service.darfProjektAnlegen(benutzer)).isFalse();
			assertThat(service.darfGenehmigen(benutzer, p)).isFalse();
			assertThat(service.darfUserVerwalten(benutzer)).isFalse();
			assertThat(service.darfProjektLesen(benutzer, p)).isFalse();
			// Veroeffentlichtes bleibt lesbar - das ist der PUBLIC-Rest.
			assertThat(service.darfProjektLesen(benutzer, projekt(ProjektStatus.VEROEFFENTLICHT))).isTrue();
		}
	}
}
