package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.projekt.Projekt;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Ein Projekt auf der Top-10-Liste. Der Tabellenname wird explizit gesetzt,
 * weil die Naming-Strategy aus "Top10Eintrag" sonst "top10eintrag" ableiten
 * wuerde - sie trennt nur zwischen Klein- und Grossbuchstabe, nicht nach Ziffern.
 */
@Entity
@Table(name = "top10_eintrag")
public class Top10Eintrag extends BaseEntity {

	@OneToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "projekt_id", nullable = false, unique = true)
	private Projekt projekt;

	@Column(nullable = false)
	private int position;

	@Column(nullable = false)
	private Instant aufgenommenAm;

	protected Top10Eintrag() {
		// Von JPA benoetigt.
	}

	public Projekt getProjekt() {
		return projekt;
	}

	public void setProjekt(Projekt projekt) {
		this.projekt = projekt;
	}

	public int getPosition() {
		return position;
	}

	public void setPosition(int position) {
		this.position = position;
	}

	public Instant getAufgenommenAm() {
		return aufgenommenAm;
	}

	public void setAufgenommenAm(Instant aufgenommenAm) {
		this.aufgenommenAm = aufgenommenAm;
	}
}
