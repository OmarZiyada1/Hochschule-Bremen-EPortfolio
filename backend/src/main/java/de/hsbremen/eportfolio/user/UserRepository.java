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
}
