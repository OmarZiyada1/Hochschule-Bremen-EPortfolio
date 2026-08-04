package de.hsbremen.eportfolio.comment;

import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.CommentStatus;
import de.hsbremen.eportfolio.common.enums.CommentType;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Rueckmeldung zu einem Projekt. Der Status ist nur bei
 * {@link CommentType#CHANGE_REQUEST} gesetzt, sonst null; geprueft wird das im
 * Service, nicht in der Datenbank.
 */
@Entity
public class Comment extends AuditableEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id", nullable = false)
	private Project project;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "author_id", nullable = false)
	private User author;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private CommentType type;

	@Column(columnDefinition = "text", nullable = false)
	private String text;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private CommentStatus status;

	protected Comment() {
		// Von JPA benoetigt.
	}

	/**
	 * Ein Aenderungswunsch der Redaktion an die Projektseite: Typ
	 * {@link CommentType#CHANGE_REQUEST} mit Status
	 * {@link CommentStatus#OPEN} (§2.3, §2.4).
	 *
	 * <p><strong>Warum eine benannte Fabrik</strong> und kein oeffentlicher
	 * Konstruktor: Typ und Status haengen bei diesem Kommentar zusammen, ein
	 * {@code CHANGE_REQUEST} ohne Erledigungsstatus waere ein Arbeitsauftrag, den
	 * niemand abhaken kann. Mit der Fabrik koennen die beiden Felder nicht
	 * einzeln vergessen werden.
	 *
	 * <p>Gebraucht wird sie seit KAN-19 von
	 * {@code ProjectWorkflowService.requestRevision}: §4.1 haelt die Begruendung
	 * einer Ruecknahme als Kommentar fest und nicht in der Statushistorie, weil
	 * nur der Kommentar einen Erledigungsstatus braucht.
	 */
	public static Comment changeRequest(Project project, User author, String text) {
		Comment comment = new Comment();
		comment.project = project;
		comment.author = author;
		comment.type = CommentType.CHANGE_REQUEST;
		comment.text = text;
		comment.status = CommentStatus.OPEN;
		return comment;
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public User getAuthor() {
		return author;
	}

	public void setAuthor(User author) {
		this.author = author;
	}

	public CommentType getType() {
		return type;
	}

	public void setType(CommentType type) {
		this.type = type;
	}

	public String getText() {
		return text;
	}

	public void setText(String text) {
		this.text = text;
	}

	public CommentStatus getStatus() {
		return status;
	}

	public void setStatus(CommentStatus status) {
		this.status = status;
	}
}
