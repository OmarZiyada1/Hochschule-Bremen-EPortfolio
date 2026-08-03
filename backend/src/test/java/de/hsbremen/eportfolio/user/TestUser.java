package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.util.UUID;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Baut {@link User}-Instanzen fuer Tests.
 *
 * <p>Liegt in diesem Paket, weil der Konstruktor von {@code User} und der
 * {@code id}-Setter der {@code BaseEntity} nicht oeffentlich sind: im
 * Produktivcode vergibt JPA die ID. Fuer reine Unit-Tests ohne
 * Persistenzkontext muss sie gesetzt werden, sonst laesst sich kein
 * Identitaetsvergleich pruefen.
 */
public final class TestUser {

	public static User create(UUID id, String email, String hsbEmail, Role role, UserStatus status,
			String passwordHash) {
		User user = new User();
		ReflectionTestUtils.setField(user, "id", id);
		user.setEmail(email);
		user.setHsbEmail(hsbEmail);
		user.setEmailVerified(true);
		user.setHsbEmailVerified(true);
		user.setPasswordHash(passwordHash);
		user.setFirstName("Test");
		user.setLastName("Person");
		user.setRole(role);
		user.setStatus(status);
		return user;
	}

	public static User active(Role role, String passwordHash) {
		UUID id = UUID.randomUUID();
		return create(id, "privat-" + id + "@example.org", "hsb-" + id + "@stud.hs-bremen.de",
				role, UserStatus.ACTIVE, passwordHash);
	}

	/**
	 * Wie {@link #active}, nur ohne vorbelegte ID: fuer Tests, die den User
	 * tatsaechlich speichern.
	 *
	 * <p>Notwendig, weil {@code JpaRepository.save} eine Instanz mit gesetzter
	 * ID fuer bereits bekannt haelt und ueber {@code merge} statt {@code persist}
	 * geht. Im Produktivcode vergibt die ID ohnehin JPA.
	 */
	public static User activeWithoutId(Role role, String passwordHash) {
		User user = active(role, passwordHash);
		ReflectionTestUtils.setField(user, "id", null);
		return user;
	}

	private TestUser() {
	}
}
