package de.hsbremen.eportfolio.stammdaten;

import java.util.UUID;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Baut Stammdaten-Entities fuer Tests.
 *
 * <p>Liegt in diesem Paket, weil die Konstruktoren der Entities {@code protected}
 * sind und die {@code id} im Produktivcode von JPA kommt — dieselbe Begruendung
 * wie bei {@code TestUser}. Fuer Unit-Tests ohne Persistenzkontext muss sie
 * gesetzt sein, sonst laesst sich die Zuordnung Studiengang → Fakultaet nicht
 * pruefen.
 */
public final class TestStammdaten {

	public static Kategorie kategorie(String name) {
		Kategorie kategorie = new Kategorie();
		ReflectionTestUtils.setField(kategorie, "id", UUID.randomUUID());
		kategorie.setName(name);
		return kategorie;
	}

	public static Fakultaet fakultaet(String kuerzel, String name) {
		Fakultaet fakultaet = new Fakultaet();
		ReflectionTestUtils.setField(fakultaet, "id", UUID.randomUUID());
		fakultaet.setKuerzel(kuerzel);
		fakultaet.setName(name);
		return fakultaet;
	}

	public static Studiengang studiengang(String kuerzel, String name, Fakultaet fakultaet) {
		Studiengang studiengang = new Studiengang();
		ReflectionTestUtils.setField(studiengang, "id", UUID.randomUUID());
		studiengang.setKuerzel(kuerzel);
		studiengang.setName(name);
		studiengang.setFakultaet(fakultaet);
		return studiengang;
	}

	public static Modul modul(String kuerzel, String name, Studiengang studiengang) {
		Modul modul = new Modul();
		ReflectionTestUtils.setField(modul, "id", UUID.randomUUID());
		modul.setKuerzel(kuerzel);
		modul.setName(name);
		modul.setStudiengang(studiengang);
		return modul;
	}

	private TestStammdaten() {
	}
}
