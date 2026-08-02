package de.hsbremen.eportfolio.projekt;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.enums.BlockTyp;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import java.time.Instant;
import java.util.UUID;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Baut {@link Projekt}-Instanzen fuer Tests des
 * {@link ProjektBerechtigungService}.
 *
 * <p>Liegt in diesem Paket, weil der Projekt-Konstruktor JPA vorbehalten ist.
 */
public final class TestProjekt {

	public static Projekt mitAutor(User autor, ProjektStatus status) {
		Projekt projekt = new Projekt();
		ReflectionTestUtils.setField(projekt, "id", UUID.randomUUID());
		projekt.setTitel("Testprojekt");
		projekt.setAutor(autor);
		projekt.setStatus(status);
		return projekt;
	}

	/** Fuegt eine:n betreuende:n Redakteur:in hinzu (Join-Tabelle projekt_redakteur, §3.3). */
	public static Projekt mitRedakteur(Projekt projekt, User redakteur) {
		projekt.getRedakteure().add(redakteur);
		return projekt;
	}

	/** Fuegt ein Projektmitglied hinzu (Co-Autor:in, §3.13). */
	public static Projekt mitMitglied(Projekt projekt, User user) {
		Projektmitglied mitglied = new Projektmitglied();
		ReflectionTestUtils.setField(mitglied, "id", UUID.randomUUID());
		mitglied.setProjekt(projekt);
		mitglied.setUser(user);
		mitglied.setRolleImProjekt("Frontend");
		projekt.getMitglieder().add(mitglied);
		return projekt;
	}

	/**
	 * Ein {@code ENTWURF} ohne vorbelegte ID: fuer Tests, die das Projekt
	 * tatsaechlich speichern (Begruendung wie bei
	 * {@code TestUser.aktivOhneId}).
	 */
	public static Projekt entwurfOhneId(User autor) {
		Projekt projekt = mitAutor(autor, ProjektStatus.ENTWURF);
		ReflectionTestUtils.setField(projekt, "id", null);
		return projekt;
	}

	/**
	 * Wie {@link #entwurfOhneId(User)}, aber mit frei waehlbarem Status und
	 * Titel: fuer Tests, die mehrere Projekte unterscheiden muessen, etwa die
	 * Sichtbarkeits- und Sortierpruefungen der Projektliste.
	 */
	public static Projekt ohneId(User autor, ProjektStatus status, String titel) {
		Projekt projekt = mitAutor(autor, status);
		projekt.setTitel(titel);
		ReflectionTestUtils.setField(projekt, "id", null);
		return projekt;
	}

	/**
	 * Ein Projektmitglied ohne vorbelegte ID, zum Speichern ueber das
	 * Repository. Anders als {@link #mitMitglied} haengt es die Zeile nicht in
	 * die Sammlung des Projekts, weil die beim naechsten Laden ohnehin aus der
	 * Datenbank kommt.
	 */
	public static Projektmitglied mitgliedOhneId(Projekt projekt, User user, String rolleImProjekt) {
		Projektmitglied mitglied = new Projektmitglied();
		mitglied.setProjekt(projekt);
		mitglied.setUser(user);
		mitglied.setRolleImProjekt(rolleImProjekt);
		return mitglied;
	}

	/** Ein Inhaltsblock ohne vorbelegte ID (§3.4), zum Speichern ueber das Repository. */
	public static Block blockOhneId(Projekt projekt, BlockTyp typ, int reihenfolge, JsonNode inhalt) {
		Block block = new Block();
		block.setProjekt(projekt);
		block.setTyp(typ);
		block.setReihenfolge(reihenfolge);
		block.setInhalt(inhalt);
		return block;
	}

	/** Ein Statusuebergang ohne vorbelegte ID (§3.12), zum Speichern ueber das Repository. */
	public static ProjektStatusHistorie historieOhneId(Projekt projekt, ProjektStatus von,
			ProjektStatus nach, User geaendertVon, Instant zeitpunkt) {
		ProjektStatusHistorie eintrag = new ProjektStatusHistorie();
		eintrag.setProjekt(projekt);
		eintrag.setVonStatus(von);
		eintrag.setNachStatus(nach);
		eintrag.setGeaendertVon(geaendertVon);
		eintrag.setZeitpunkt(zeitpunkt);
		return eintrag;
	}

	private TestProjekt() {
	}
}
