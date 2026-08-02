package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
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

	private TestProjekt() {
	}
}
