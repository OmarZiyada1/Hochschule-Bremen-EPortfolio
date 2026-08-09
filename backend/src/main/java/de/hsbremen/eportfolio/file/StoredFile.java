package de.hsbremen.eportfolio.file;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Eine hochgeladene Datei (API-Contract §3.15): Bild, Audio, Dokument, Avatar
 * oder Coverbild.
 *
 * <p>Die Zeile haelt nur Metadaten. Die Bytes liegen in einem Objektspeicher
 * hinter dem Port {@link FileStorage} (§3.15.1); {@link #getPath()} ist der
 * anbieterneutrale Schluessel dorthin und <strong>verlaesst den Server
 * nie</strong>: ausgeliefert wuerde er eine zweite, an der
 * Berechtigungspruefung vorbeifuehrende Zugriffsmoeglichkeit eroeffnen.
 *
 * <p>Wie {@code VerificationCode} nur mit {@code createdAt} und ohne
 * {@code updatedAt}: eine Datei wird hochgeladen und geloescht, nie geaendert.
 * §3.15 fuehrt deshalb nur {@code createdAt}.
 */
@Entity
@Table(name = "stored_file")
@EntityListeners(AuditingEntityListener.class)
public class StoredFile extends BaseEntity {

	/**
	 * {@code null} bedeutet Avatar (§3.15): der gehoert zu einer Person, nicht
	 * zu einem Projekt, und ist deshalb ohne Anmeldung abrufbar.
	 */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id")
	private Project project;

	/**
	 * Wer hochgeladen hat, entscheidet mit ueber das Loeschen (§6.1,
	 * "Uploader:in / ADMIN"). Deshalb kaskadiert die Spalte in der Migration
	 * bewusst nicht mit dem Konto.
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "uploaded_by", nullable = false)
	private User uploadedBy;

	@Column(name = "file_name", nullable = false, length = 255)
	private String fileName;

	@Column(name = "mime_type", nullable = false, length = 64)
	private String mimeType;

	@Column(nullable = false)
	private long size;

	@Column(nullable = false, length = 255)
	private String path;

	@CreatedDate
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public User getUploadedBy() {
		return uploadedBy;
	}

	public void setUploadedBy(User uploadedBy) {
		this.uploadedBy = uploadedBy;
	}

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}

	public String getMimeType() {
		return mimeType;
	}

	public void setMimeType(String mimeType) {
		this.mimeType = mimeType;
	}

	public long getSize() {
		return size;
	}

	public void setSize(long size) {
		this.size = size;
	}

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
