package de.hsbremen.eportfolio.comment;

import de.hsbremen.eportfolio.common.enums.CommentStatus;
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
	 * Wie viele Kommentare eines Typs in einem Status an einem Projekt haengen.
	 *
	 * <p>Gebraucht von {@code ProjectWorkflowService.submit} (KAN-59): haengen
	 * am Projekt noch {@code CHANGE_REQUEST}-Kommentare im Status {@code OPEN},
	 * wird das Einreichen mit 409 {@code CHANGE_REQUESTS_OPEN} abgewiesen, und
	 * die Meldung nennt diese Anzahl (§2.4). Ein {@code COUNT} statt eines
	 * {@code exists…}, weil die Meldung die Zahl braucht und die Abfrage sonst
	 * doppelt liefe.
	 */
	long countByProjectIdAndTypeAndStatus(UUID projectId, CommentType type,
			CommentStatus status);

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
