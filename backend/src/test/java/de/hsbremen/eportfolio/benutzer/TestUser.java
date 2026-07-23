package de.hsbremen.eportfolio.benutzer;

import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.util.UUID;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Baut {@link User}-Instanzen fuer Tests.
 *
 * <p>Liegt in diesem Paket, weil der Konstruktor von {@code User} und der
 * {@code id}-Setter der {@code BaseEntity} nicht oeffentlich sind — im
 * Produktivcode vergibt JPA die ID. Fuer reine Unit-Tests ohne
 * Persistenzkontext muss sie gesetzt werden, sonst laesst sich kein
 * Identitaetsvergleich pruefen.
 */
public final class TestUser {

	public static User erzeuge(UUID id, String email, String hsbEmail, Rolle rolle, UserStatus status,
			String passwortHash) {
		User user = new User();
		ReflectionTestUtils.setField(user, "id", id);
		user.setEmail(email);
		user.setHsbEmail(hsbEmail);
		user.setEmailVerifiziert(true);
		user.setHsbEmailVerifiziert(true);
		user.setPasswortHash(passwortHash);
		user.setVorname("Test");
		user.setNachname("Person");
		user.setRolle(rolle);
		user.setStatus(status);
		return user;
	}

	public static User aktiv(Rolle rolle, String passwortHash) {
		UUID id = UUID.randomUUID();
		return erzeuge(id, "privat-" + id + "@example.org", "hsb-" + id + "@stud.hs-bremen.de",
				rolle, UserStatus.AKTIV, passwortHash);
	}

	private TestUser() {
	}
}
