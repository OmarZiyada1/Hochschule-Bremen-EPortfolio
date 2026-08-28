package de.hsbremen.eportfolio.support;

import de.hsbremen.eportfolio.common.enums.SupportRequestCategory;
import de.hsbremen.eportfolio.common.enums.SupportRequestStatus;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Zugriff auf die eingegangenen Support-Anfragen (§3.20).
 */
public interface SupportRequestRepository extends JpaRepository<SupportRequest, UUID> {

	/**
	 * Die Liste der Administration (§6.1), gefiltert nach {@code status} und
	 * {@code category}. Beide Parameter sind optional; {@code null} laesst die
	 * jeweilige Einschraenkung weg.
	 *
	 * <p><strong>Eine Abfrage mit zwei Null-Zweigen statt vier Methoden.</strong>
	 * Die vier Kombinationen als eigene Ableitungen zu fuehren
	 * ({@code findByStatus}, {@code findByCategory}, beide zusammen, keines)
	 * hiesse, dieselbe Reihenfolge und dieselbe Semantik viermal zu
	 * wiederholen; beim naechsten Filter waeren es acht.
	 *
	 * <p>Die Sortierung steht bewusst <em>nicht</em> hier, sondern kommt als
	 * {@link Pageable} herein: sie ist in §6.6 festgelegt und der Dienst setzt
	 * sie, damit der eine Ort, an dem sie steht, derselbe ist, der auch den
	 * mitgeschickten {@code sort} verwirft.
	 */
	@Query("""
			select r from SupportRequest r
			where (:status is null or r.status = :status)
			  and (:category is null or r.category = :category)
			""")
	Page<SupportRequest> search(SupportRequestStatus status, SupportRequestCategory category,
			Pageable pageable);
}
