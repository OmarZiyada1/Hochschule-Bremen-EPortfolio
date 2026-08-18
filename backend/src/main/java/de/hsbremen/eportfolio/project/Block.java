package de.hsbremen.eportfolio.project;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.BlockType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Geordneter Inhaltsbaustein eines Projekts. {@code content} enthaelt genau
 * einen Top-Level-Knoten des ProseMirror-Dokuments unveraendert als JSON;
 * {@code type} ist die abfragbare Projektion von {@code content.type}.
 *
 * <p>Das Feld heisst {@code orderIndex} und nicht {@code order}, weil
 * {@code order} in SQL ein reserviertes Wort ist und die Spalte sonst dauerhaft
 * in Anfuehrungszeichen stuende (docs/NAMENSSCHEMA.md §4).
 */
@Entity
public class Block extends AuditableEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id", nullable = false)
	private Project project;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private BlockType type;

	@Column(nullable = false)
	private int orderIndex;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private JsonNode content;

	/**
	 * Version des Block-JSON-Formats (API-Contract §2.10).
	 *
	 * <p><strong>Seit Contract v51 gilt 2</strong> (KAN-72): §2.5 hat mehrere
	 * Attributformen geaendert, und §2.10 verlangt dafuer eine erhoehte Version
	 * samt Migrationsfunktion ({@link BlockSchemaMigration}). Der Default der
	 * Spalte steht weiterhin auf 1 und wird bewusst nicht per Migration
	 * angefasst: er beschreibt, was eine Zeile ohne ausdrueckliche Angabe
	 * bedeutet, und das sind die vor v51 geschriebenen Dokumente. Neue Zeilen
	 * bekommen den Wert von hier, weil JPA die Spalte immer mitschreibt.
	 */
	@Column(nullable = false)
	private int schemaVersion = BlockSchemaMigration.CURRENT_VERSION;

	protected Block() {
		// Von JPA benoetigt.
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public BlockType getType() {
		return type;
	}

	public void setType(BlockType type) {
		this.type = type;
	}

	public int getOrderIndex() {
		return orderIndex;
	}

	public void setOrderIndex(int orderIndex) {
		this.orderIndex = orderIndex;
	}

	public JsonNode getContent() {
		return content;
	}

	public void setContent(JsonNode content) {
		this.content = content;
	}

	public int getSchemaVersion() {
		return schemaVersion;
	}

	public void setSchemaVersion(int schemaVersion) {
		this.schemaVersion = schemaVersion;
	}
}
