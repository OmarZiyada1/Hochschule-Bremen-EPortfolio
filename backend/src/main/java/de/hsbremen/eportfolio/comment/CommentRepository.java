package de.hsbremen.eportfolio.comment;

import de.hsbremen.eportfolio.common.enums.CommentType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Kommentare.
 */
public interface CommentRepository extends JpaRepository<Comment, UUID> {

	List<Comment> findByProjectId(UUID projectId);

	List<Comment> findByProjectIdAndType(UUID projectId, CommentType type);
}
