package de.hsbremen.eportfolio.projekt;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.BlockTyp;
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
 * Geordneter Inhaltsbaustein eines Projekts. {@code inhalt} enthaelt genau
 * einen Top-Level-Knoten des ProseMirror-Dokuments unveraendert als JSON;
 * {@code typ} ist die abfragbare Projektion von {@code inhalt.type}.
 */
@Entity
public class Block extends AuditableEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "projekt_id", nullable = false)
	private Projekt projekt;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private BlockTyp typ;

	@Column(nullable = false)
	private int reihenfolge;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false, columnDefinition = "jsonb")
	private JsonNode inhalt;

	/**
	 * Version des Block-JSON-Formats (API-Contract §2.10). Entspricht dem
	 * Default der Spalte, da JPA die Spalte immer mitschreibt.
	 */
	@Column(nullable = false)
	private int schemaVersion = 1;

	protected Block() {
		// Von JPA benoetigt.
	}

	public Projekt getProjekt() {
		return projekt;
	}

	public void setProjekt(Projekt projekt) {
		this.projekt = projekt;
	}

	public BlockTyp getTyp() {
		return typ;
	}

	public void setTyp(BlockTyp typ) {
		this.typ = typ;
	}

	public int getReihenfolge() {
		return reihenfolge;
	}

	public void setReihenfolge(int reihenfolge) {
		this.reihenfolge = reihenfolge;
	}

	public JsonNode getInhalt() {
		return inhalt;
	}

	public void setInhalt(JsonNode inhalt) {
		this.inhalt = inhalt;
	}

	public int getSchemaVersion() {
		return schemaVersion;
	}

	public void setSchemaVersion(int schemaVersion) {
		this.schemaVersion = schemaVersion;
	}
}
