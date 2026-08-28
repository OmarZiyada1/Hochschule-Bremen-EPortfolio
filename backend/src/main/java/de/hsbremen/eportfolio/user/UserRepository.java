package de.hsbremen.eportfolio.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

/**
 * Datenbankzugriff auf Benutzerkonten.
 *
 * <p>{@code JpaSpecificationExecutor} kommt mit KAN-25 wegen der Filterliste von
 * {@code GET /api/admin/users} dazu ({@code role}, {@code status}, {@code q},
 * §6.1). Dieselbe Ueberlegung wie beim {@code ProjectRepository}: drei optionale
 * Filter in freier Kombination lassen sich als abgeleitete Methodennamen nicht
 * mehr sinnvoll abbilden. Die Bausteine stehen in
 * {@code admin.AdminUserSpecifications}.
 */
public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

	Optional<User> findByEmail(String email);

	Optional<User> findByHsbEmail(String hsbEmail);

	/**
	 * Alle Konten mit dieser Wunschadresse eines laufenden E-Mail-Wechsels
	 * (§3.1, KAN-60).
	 *
	 * <p>Eine Liste und kein {@code Optional}: {@code pending_email} ist bewusst
	 * nicht eindeutig, zwei Konten duerfen dieselbe Adresse gleichzeitig
	 * anstreben. Wer von ihnen gemeint ist, entscheidet der eingeloeste Code.
	 */
	List<User> findByPendingEmail(String pendingEmail);

	/**
	 * Kennzahl {@code usersByRole} des Admin-Dashboards (§6.1).
	 *
	 * <p>Eine Abfrage mit {@code group by} statt eines {@code countByRole} je
	 * Enum-Wert, siehe {@link UserRoleCount}.
	 */
	@Query("select new de.hsbremen.eportfolio.user.UserRoleCount(u.role, count(u)) "
			+ "from User u group by u.role")
	List<UserRoleCount> countPerRole();

	/** Kennzahl {@code usersByStatus} des Admin-Dashboards (§6.1, §2.9). */
	@Query("select new de.hsbremen.eportfolio.user.UserStatusCount(u.status, count(u)) "
			+ "from User u group by u.status")
	List<UserStatusCount> countPerStatus();

	/**
	 * Nur der Name eines Kontos, fuer die Anzeige der Bearbeitungssperre
	 * (§6.9, KAN-86).
	 *
	 * <p>Eine Projektion statt {@code findById}: der Herzschlag laeuft je
	 * offenem Editor alle zehn Sekunden, und er braucht zwei Felder. Das
	 * ganze Konto zu laden zoege dabei Passwort-Hash und beide Adressen mit,
	 * die in dieser Antwort ohnehin nichts zu suchen haben (§3.1).
	 */
	@Query("select new de.hsbremen.eportfolio.user.UserName(u.firstName, u.lastName) "
			+ "from User u where u.id = :id")
	Optional<UserName> findNameById(UUID id);
}
