package de.hsbremen.eportfolio.comment;

import de.hsbremen.eportfolio.common.enums.CommentType;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Kommentare.
 *
 * <p><strong>Die Sichtbarkeitsfilterung steckt in der Abfrage</strong> und
 * nicht in einem Filter ueber die geladene Liste: eine {@code NOTE} soll auf
 * dem Weg zu Studierenden gar nicht erst entstehen (§2.3). Fuer den Lesepfad
 * von {@code GET /api/projects/{id}/comments} gibt es deshalb ausschliesslich
 * {@link #findByProjectIdAndTypeInOrderByCreatedAtAsc}, auch fuer Redaktion und
 * Administration, die alle drei Typen sehen duerfen. Ein zweites, ungefiltertes
 * Gegenstueck waere die Methode, die beim naechsten Umbau versehentlich am
 * falschen Ende aufgerufen wird.
 */
public interface CommentRepository extends JpaRepository<Comment, UUID> {

	List<Comment> findByProjectId(UUID projectId);

	List<Comment> findByProjectIdAndType(UUID projectId, CommentType type);

	/**
	 * Die Kommentare eines Projekts, auf die sichtbaren Typen eingegrenzt und
	 * sortiert nach {@code createdAt} aufsteigend (§6.1). Welche Typen das sind,
	 * entscheidet {@code CommentService.visibleTypes} anhand von §2.3 und §5.
	 *
	 * <p>Der {@code @EntityGraph} zieht die Verfasser:in mit: ohne ihn laedt
	 * Hibernate sie je Kommentar einzeln nach (N+1), und genau diese Zeile
	 * braucht jede Antwort fuer {@code author} (§3.5).
	 */
	@EntityGraph(attributePaths = "author")
	List<Comment> findByProjectIdAndTypeInOrderByCreatedAtAsc(UUID projectId,
			Collection<CommentType> types);
}
