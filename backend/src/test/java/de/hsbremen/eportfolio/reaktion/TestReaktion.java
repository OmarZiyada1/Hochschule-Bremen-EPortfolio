package de.hsbremen.eportfolio.reaktion;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.projekt.Projekt;

/**
 * Baut {@link Reaktion}-Instanzen fuer Tests.
 *
 * <p>Liegt in diesem Paket, weil der Konstruktor von {@code Reaktion} JPA
 * vorbehalten ist, dieselbe Begruendung wie bei {@code TestProjekt}. Die
 * {@code id} bleibt leer, damit {@code save} die Zeile wirklich einfuegt.
 */
public final class TestReaktion {

	public static Reaktion ohneId(Projekt projekt, User user) {
		Reaktion reaktion = new Reaktion();
		reaktion.setProjekt(projekt);
		reaktion.setUser(user);
		return reaktion;
	}

	private TestReaktion() {
	}
}
