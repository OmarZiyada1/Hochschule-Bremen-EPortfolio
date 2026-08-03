package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Vorschlag, ein Projekt in die Top-10 aufzunehmen. Solange die Nominierung
 * offen ist, bleiben decidedBy und decidedAt leer.
 *
 * <p>Der Tabellenname wird wie bei {@link Top10Entry} explizit gesetzt.
 */
@Entity
@Table(name = "top10_nomination")
@EntityListeners(AuditingEntityListener.class)
public class Top10Nomination extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id", nullable = false)
	private Project project;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "nominated_by", nullable = false)
	private User nominatedBy;

	/** Wrapper-Typ, weil die Spalte nullable ist. */
	private Integer proposedPosition;

	/** Entspricht dem Default der Spalte, da JPA die Spalte immer mitschreibt. */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private NominationStatus status = NominationStatus.PENDING;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "decided_by")
	private User decidedBy;

	private Instant decidedAt;

	@CreatedDate
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected Top10Nomination() {
		// Von JPA benoetigt.
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public User getNominatedBy() {
		return nominatedBy;
	}

	public void setNominatedBy(User nominatedBy) {
		this.nominatedBy = nominatedBy;
	}

	public Integer getProposedPosition() {
		return proposedPosition;
	}

	public void setProposedPosition(Integer proposedPosition) {
		this.proposedPosition = proposedPosition;
	}

	public NominationStatus getStatus() {
		return status;
	}

	public void setStatus(NominationStatus status) {
		this.status = status;
	}

	public User getDecidedBy() {
		return decidedBy;
	}

	public void setDecidedBy(User decidedBy) {
		this.decidedBy = decidedBy;
	}

	public Instant getDecidedAt() {
		return decidedAt;
	}

	public void setDecidedAt(Instant decidedAt) {
		this.decidedAt = decidedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
