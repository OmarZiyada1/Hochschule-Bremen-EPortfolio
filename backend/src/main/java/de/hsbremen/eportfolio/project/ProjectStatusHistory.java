package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Ein Statusuebergang eines Projekts. fromStatus ist beim ersten Uebergang
 * null, weil es dann noch keinen Vorzustand gibt.
 */
@Entity
@Table(name = "project_status_history")
public class ProjectStatusHistory extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id", nullable = false)
	private Project project;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private ProjectStatus fromStatus;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ProjectStatus toStatus;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "changed_by", nullable = false)
	private User changedBy;

	/**
	 * Spaltenname bewusst {@code timestamp}: das Wort ist in Postgres ein
	 * col_name_keyword und als Spaltenname ohne Anfuehrungszeichen zulaessig,
	 * anders als {@code order} bei {@link Block#getOrderIndex()}.
	 */
	@Column(nullable = false)
	private Instant timestamp;

	protected ProjectStatusHistory() {
		// Von JPA benoetigt.
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public ProjectStatus getFromStatus() {
		return fromStatus;
	}

	public void setFromStatus(ProjectStatus fromStatus) {
		this.fromStatus = fromStatus;
	}

	public ProjectStatus getToStatus() {
		return toStatus;
	}

	public void setToStatus(ProjectStatus toStatus) {
		this.toStatus = toStatus;
	}

	public User getChangedBy() {
		return changedBy;
	}

	public void setChangedBy(User changedBy) {
		this.changedBy = changedBy;
	}

	public Instant getTimestamp() {
		return timestamp;
	}

	public void setTimestamp(Instant timestamp) {
		this.timestamp = timestamp;
	}
}
