package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.Abschluss;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Projekttyp;
import de.hsbremen.eportfolio.stammdaten.Fakultaet;
import de.hsbremen.eportfolio.stammdaten.Kategorie;
import de.hsbremen.eportfolio.stammdaten.Modul;
import de.hsbremen.eportfolio.stammdaten.Studiengang;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Projekt als Aggregatwurzel. Autor:in ist verpflichtend, die fachliche
 * Zuordnung (Fakultaet, Studiengang, Modul, Kategorie) dagegen optional.
 */
@Entity
@Table(name = "projekt")
public class Projekt extends AuditableEntity {

	@Column(nullable = false, length = 255)
	private String titel;

	@Column(length = 1024)
	private String kurzbeschreibung;

	@Column(length = 1024)
	private String coverBildUrl;

	/** Entspricht dem Default der Spalte, da JPA die Spalte immer mitschreibt. */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ProjektStatus status = ProjektStatus.ENTWURF;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private Projekttyp projekttyp;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private Abschluss abschluss;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "autor_id", nullable = false)
	private User autor;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "fakultaet_id")
	private Fakultaet fakultaet;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "studiengang_id")
	private Studiengang studiengang;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "modul_id")
	private Modul modul;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "kategorie_id")
	private Kategorie kategorie;

	@Column(length = 64)
	private String semester;

	private Instant veroeffentlichtAm;

	@ElementCollection
	@CollectionTable(name = "projekt_tag", joinColumns = @JoinColumn(name = "projekt_id"))
	@Column(name = "tag", length = 64)
	private Set<String> tags = new HashSet<>();

	@ManyToMany(fetch = FetchType.LAZY)
	@JoinTable(name = "projekt_redakteur",
			joinColumns = @JoinColumn(name = "projekt_id"),
			inverseJoinColumns = @JoinColumn(name = "user_id"))
	private Set<User> redakteure = new HashSet<>();

	@OneToMany(mappedBy = "projekt", cascade = CascadeType.ALL, orphanRemoval = true)
	private Set<Projektmitglied> mitglieder = new HashSet<>();

	/** Geordneter Inhalt; die Reihenfolge liegt in Block.reihenfolge. */
	@OneToMany(mappedBy = "projekt", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("reihenfolge ASC")
	private List<Block> blocks = new ArrayList<>();

	protected Projekt() {
		// Von JPA benoetigt.
	}

	public String getTitel() {
		return titel;
	}

	public void setTitel(String titel) {
		this.titel = titel;
	}

	public String getKurzbeschreibung() {
		return kurzbeschreibung;
	}

	public void setKurzbeschreibung(String kurzbeschreibung) {
		this.kurzbeschreibung = kurzbeschreibung;
	}

	public String getCoverBildUrl() {
		return coverBildUrl;
	}

	public void setCoverBildUrl(String coverBildUrl) {
		this.coverBildUrl = coverBildUrl;
	}

	public ProjektStatus getStatus() {
		return status;
	}

	public void setStatus(ProjektStatus status) {
		this.status = status;
	}

	public Projekttyp getProjekttyp() {
		return projekttyp;
	}

	public void setProjekttyp(Projekttyp projekttyp) {
		this.projekttyp = projekttyp;
	}

	public Abschluss getAbschluss() {
		return abschluss;
	}

	public void setAbschluss(Abschluss abschluss) {
		this.abschluss = abschluss;
	}

	public User getAutor() {
		return autor;
	}

	public void setAutor(User autor) {
		this.autor = autor;
	}

	public Fakultaet getFakultaet() {
		return fakultaet;
	}

	public void setFakultaet(Fakultaet fakultaet) {
		this.fakultaet = fakultaet;
	}

	public Studiengang getStudiengang() {
		return studiengang;
	}

	public void setStudiengang(Studiengang studiengang) {
		this.studiengang = studiengang;
	}

	public Modul getModul() {
		return modul;
	}

	public void setModul(Modul modul) {
		this.modul = modul;
	}

	public Kategorie getKategorie() {
		return kategorie;
	}

	public void setKategorie(Kategorie kategorie) {
		this.kategorie = kategorie;
	}

	public String getSemester() {
		return semester;
	}

	public void setSemester(String semester) {
		this.semester = semester;
	}

	public Instant getVeroeffentlichtAm() {
		return veroeffentlichtAm;
	}

	public void setVeroeffentlichtAm(Instant veroeffentlichtAm) {
		this.veroeffentlichtAm = veroeffentlichtAm;
	}

	public Set<String> getTags() {
		return tags;
	}

	public void setTags(Set<String> tags) {
		this.tags = tags;
	}

	public Set<User> getRedakteure() {
		return redakteure;
	}

	public void setRedakteure(Set<User> redakteure) {
		this.redakteure = redakteure;
	}

	public Set<Projektmitglied> getMitglieder() {
		return mitglieder;
	}

	public void setMitglieder(Set<Projektmitglied> mitglieder) {
		this.mitglieder = mitglieder;
	}

	public List<Block> getBlocks() {
		return blocks;
	}

	public void setBlocks(List<Block> blocks) {
		this.blocks = blocks;
	}
}
