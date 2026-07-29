package de.hsbremen.eportfolio.stammdaten;

import de.hsbremen.eportfolio.stammdaten.dto.FakultaetAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.KategorieAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.ModulAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.StudiengangAntwort;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lesezugriff auf die Referenzlisten aus §3.6–3.9.
 *
 * <p>Alle vier Listen gehen sortiert nach {@code name} und ohne Paginierung
 * heraus (§6.1). Das ist kein vergessenes Seitenmodell: es sind kleine, selten
 * veraenderliche Listen, die das Frontend vollstaendig braucht — als Dropdown
 * bei Projektanlage und Registrierung und als Filterleiste der Projektliste.
 * Eine Seitenaufteilung wuerde dort nur einen zweiten Ladeweg erzeugen.
 *
 * <p><strong>Keine Berechtigungspruefung:</strong> die Endpoints sind PUBLIC
 * (§5). Stammdaten haengen an keiner Ressource mit Eigentuemer, es gibt also
 * nichts, was der {@code ProjektBerechtigungService} hier entscheiden koennte.
 * Sie enthalten auch nichts Schuetzenswertes — Fakultaets- und Modulnamen der
 * Hochschule stehen ohnehin oeffentlich im Netz.
 */
@Service
// Klassenweit, weil jede Methode dieser Klasse ausschliesslich liest. readOnly
// erspart Hibernate den Dirty-Check und macht die Absicht sichtbar.
@Transactional(readOnly = true)
public class StammdatenService {

	private final KategorieRepository kategorieRepository;

	private final FakultaetRepository fakultaetRepository;

	private final StudiengangRepository studiengangRepository;

	private final ModulRepository modulRepository;

	public StammdatenService(KategorieRepository kategorieRepository, FakultaetRepository fakultaetRepository,
			StudiengangRepository studiengangRepository, ModulRepository modulRepository) {
		this.kategorieRepository = kategorieRepository;
		this.fakultaetRepository = fakultaetRepository;
		this.studiengangRepository = studiengangRepository;
		this.modulRepository = modulRepository;
	}

	/** Alle Kategorien fuer {@code GET /api/kategorien}. */
	public List<KategorieAntwort> kategorien() {
		return kategorieRepository.findAllByOrderByNameAsc().stream()
				.map(KategorieAntwort::aus)
				.toList();
	}

	/** Alle Fakultaeten fuer {@code GET /api/fakultaeten}. */
	public List<FakultaetAntwort> fakultaeten() {
		return fakultaetRepository.findAllByOrderByNameAsc().stream()
				.map(FakultaetAntwort::aus)
				.toList();
	}

	/**
	 * Studiengaenge fuer {@code GET /api/studiengaenge}, optional auf eine
	 * Fakultaet eingeschraenkt.
	 *
	 * <p>Eine unbekannte {@code fakultaetId} ergibt eine leere Liste und kein
	 * 404: der Parameter filtert eine Liste, er adressiert keine Ressource. Ein
	 * 404 wuerde ausserdem die Aussage „diese Fakultaet gibt es nicht" treffen,
	 * die dieser Endpoint gar nicht verantwortet.
	 *
	 * @param fakultaetId Filter; {@code null} liefert alle Studiengaenge
	 */
	public List<StudiengangAntwort> studiengaenge(UUID fakultaetId) {
		List<Studiengang> gefunden = fakultaetId == null
				? studiengangRepository.findAllByOrderByNameAsc()
				: studiengangRepository.findByFakultaetIdOrderByNameAsc(fakultaetId);

		return gefunden.stream()
				.map(StudiengangAntwort::aus)
				.toList();
	}

	/**
	 * Module fuer {@code GET /api/module}, optional auf einen Studiengang
	 * eingeschraenkt. Zur unbekannten ID gilt dasselbe wie bei
	 * {@link #studiengaenge(UUID)}.
	 *
	 * @param studiengangId Filter; {@code null} liefert alle Module
	 */
	public List<ModulAntwort> module(UUID studiengangId) {
		List<Modul> gefunden = studiengangId == null
				? modulRepository.findAllByOrderByNameAsc()
				: modulRepository.findByStudiengangIdOrderByNameAsc(studiengangId);

		return gefunden.stream()
				.map(ModulAntwort::aus)
				.toList();
	}
}
