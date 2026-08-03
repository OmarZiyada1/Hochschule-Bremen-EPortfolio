package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.project.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Ein Projekt auf der Top-10-Liste. Der Tabellenname wird explizit gesetzt,
 * weil die Naming-Strategy aus "Top10Entry" sonst "top10entry" ableiten wuerde:
 * sie trennt nur zwischen Klein- und Grossbuchstabe, nicht nach Ziffern.
 */
@Entity
@Table(name = "top10_entry")
public class Top10Entry extends BaseEntity {

	@OneToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id", nullable = false, unique = true)
	private Project project;

	@Column(nullable = false)
	private int position;

	@Column(nullable = false)
	private Instant addedAt;

	protected Top10Entry() {
		// Von JPA benoetigt.
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public int getPosition() {
		return position;
	}

	public void setPosition(int position) {
		this.position = position;
	}

	public Instant getAddedAt() {
		return addedAt;
	}

	public void setAddedAt(Instant addedAt) {
		this.addedAt = addedAt;
	}
}
