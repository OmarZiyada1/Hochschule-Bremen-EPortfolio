package de.hsbremen.eportfolio.stammdaten;

import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Legt Beispiel-Stammdaten an — <strong>nur im Profil dev</strong>.
 *
 * <p>Ohne diese Daten sind die vier Endpoints aus §6.1 leere Listen, und weder
 * die Projektanlage noch die Filterleiste der Projektliste lassen sich im
 * Frontend ausprobieren.
 *
 * <p>Bewusst ein Seeder und keine Flyway-Migration — anders begruendet als beim
 * {@code DevTestnutzerSeeder}, wo es um einen Passworthash ging: Fakultaeten,
 * Studiengaenge und Module sind hier <em>Beispieldaten</em>, keine gepflegte
 * Referenzliste der Hochschule. Die Fakultaeten stimmen, die Studiengaenge und
 * Module sind plausibel erfunden. Eine Migration wuerde sie in jede Umgebung
 * tragen, auch in die produktive; dort gehoert stattdessen der echte Bestand
 * hin, gepflegt ueber die Administrationsseite oder einen Import.
 *
 * <p><strong>Mehrfach ausfuehrbar:</strong> der Runner laeuft bei jedem Start,
 * die Entwicklungsdatenbank ueberlebt Neustarts. Jeder Datensatz wird deshalb
 * ueber seinen fachlichen Schluessel gesucht, bevor er angelegt wird:
 * {@code kategorie.name}, {@code fakultaet.kuerzel} sowie Name plus
 * Elternschluessel bei Studiengang und Modul. Vorhandene Zeilen bleiben
 * unangetastet — der Seeder ergaenzt, er korrigiert nicht. Wer einen Namen in
 * dieser Datei aendert, bekommt daher einen zusaetzlichen Datensatz und nicht
 * den umbenannten alten.
 *
 * <p>Liegt im Paket {@code stammdaten}, weil die Konstruktoren der Entities
 * bewusst {@code protected} sind (JPA). Die Entities aus KAN-4 bleiben dadurch
 * unveraendert.
 */
@Component
@Profile("dev")
public class DevStammdatenSeeder implements ApplicationRunner {

	private static final Logger LOG = LoggerFactory.getLogger(DevStammdatenSeeder.class);

	/**
	 * Kategorien aus §3.6–3.9. Bewusst eine kurze, allgemeine Liste: sie soll
	 * die Filterleiste fuellen, nicht eine fachliche Taxonomie vorwegnehmen.
	 */
	private static final List<String> KATEGORIEN = List.of(
			"Abschlussarbeit",
			"Forschungsprojekt",
			"Interaktive Medien",
			"Lehrveranstaltung",
			"Praxisprojekt",
			"Semesterprojekt",
			"Studentische Initiative",
			"Wettbewerbsbeitrag");

	/**
	 * FK1 bis FK5 der Hochschule Bremen mit ihren offiziellen Kuerzeln. Die
	 * Fakultaetsnamen entsprechen dem oeffentlichen Stand der Hochschule, die
	 * Studiengaenge und Module darunter sind Beispiele.
	 */
	private static final List<FakultaetSaat> FAKULTAETEN = List.of(
			fakultaet("FK1", "Wirtschaftswissenschaften",
					studiengang("BW", "Betriebswirtschaft",
							modul("BUB", "Buchführung und Bilanzierung"),
							modul("MAR", "Marketing")),
					studiengang("WIN", "Wirtschaftsinformatik",
							modul("GPM", "Geschäftsprozessmanagement"),
							modul("DBS", "Datenbanksysteme"))),

			fakultaet("FK2", "Architektur, Bau und Umwelt",
					studiengang("ARC", "Architektur",
							modul("EUK", "Entwerfen und Konstruieren"),
							modul("BGE", "Baugeschichte")),
					studiengang("BIW", "Bauingenieurwesen",
							modul("TME", "Technische Mechanik"),
							modul("WAB", "Wasserbau"))),

			fakultaet("FK3", "Gesellschaftswissenschaften",
					studiengang("SOA", "Soziale Arbeit",
							modul("SOP", "Sozialpädagogik"),
							modul("RSA", "Recht in der Sozialen Arbeit")),
					studiengang("AFW", "Angewandte Freizeitwissenschaft",
							modul("FRP", "Freizeitpädagogik"),
							modul("EVM", "Eventmanagement"))),

			fakultaet("FK4", "Elektrotechnik und Informatik",
					studiengang("INF", "Informatik",
							modul("GDP", "Grundlagen der Programmierung"),
							modul("SWT", "Softwaretechnik")),
					studiengang("MIN", "Medieninformatik",
							modul("MMI", "Mensch-Maschine-Interaktion"),
							modul("WEB", "Webtechnologien")),
					studiengang("ELT", "Elektrotechnik",
							modul("RET", "Regelungstechnik"),
							modul("EMS", "Eingebettete Systeme"))),

			fakultaet("FK5", "Natur und Technik",
					studiengang("BIO", "Biologie",
							modul("ZBI", "Zellbiologie"),
							modul("OEK", "Ökologie")),
					studiengang("BNK", "Bionik",
							modul("BME", "Biomechanik"),
							modul("WKU", "Werkstoffkunde"))));

	private final KategorieRepository kategorieRepository;

	private final FakultaetRepository fakultaetRepository;

	private final StudiengangRepository studiengangRepository;

	private final ModulRepository modulRepository;

	public DevStammdatenSeeder(KategorieRepository kategorieRepository, FakultaetRepository fakultaetRepository,
			StudiengangRepository studiengangRepository, ModulRepository modulRepository) {
		this.kategorieRepository = kategorieRepository;
		this.fakultaetRepository = fakultaetRepository;
		this.studiengangRepository = studiengangRepository;
		this.modulRepository = modulRepository;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		int neu = 0;

		for (String name : KATEGORIEN) {
			neu += legeKategorieAn(name);
		}
		for (FakultaetSaat saat : FAKULTAETEN) {
			neu += legeFakultaetAn(saat);
		}

		if (neu > 0) {
			LOG.info("Dev-Stammdaten ergaenzt: {} neue Datensaetze.", neu);
		}
	}

	private int legeKategorieAn(String name) {
		if (kategorieRepository.findByName(name).isPresent()) {
			return 0;
		}

		Kategorie kategorie = new Kategorie();
		kategorie.setName(name);
		kategorieRepository.save(kategorie);
		return 1;
	}

	private int legeFakultaetAn(FakultaetSaat saat) {
		int neu = 0;

		Optional<Fakultaet> vorhanden = fakultaetRepository.findByKuerzel(saat.kuerzel());
		Fakultaet fakultaet;
		if (vorhanden.isPresent()) {
			fakultaet = vorhanden.get();
		}
		else {
			Fakultaet neue = new Fakultaet();
			neue.setKuerzel(saat.kuerzel());
			neue.setName(saat.name());
			fakultaet = fakultaetRepository.save(neue);
			neu++;
		}

		for (StudiengangSaat studiengang : saat.studiengaenge()) {
			neu += legeStudiengangAn(fakultaet, studiengang);
		}
		return neu;
	}

	private int legeStudiengangAn(Fakultaet fakultaet, StudiengangSaat saat) {
		int neu = 0;

		Optional<Studiengang> vorhanden =
				studiengangRepository.findByFakultaetIdAndName(fakultaet.getId(), saat.name());
		Studiengang studiengang;
		if (vorhanden.isPresent()) {
			studiengang = vorhanden.get();
		}
		else {
			Studiengang neuer = new Studiengang();
			neuer.setKuerzel(saat.kuerzel());
			neuer.setName(saat.name());
			neuer.setFakultaet(fakultaet);
			studiengang = studiengangRepository.save(neuer);
			neu++;
		}

		for (ModulSaat modul : saat.module()) {
			neu += legeModulAn(studiengang, modul);
		}
		return neu;
	}

	private int legeModulAn(Studiengang studiengang, ModulSaat saat) {
		if (modulRepository.findByStudiengangIdAndName(studiengang.getId(), saat.name()).isPresent()) {
			return 0;
		}

		Modul modul = new Modul();
		modul.setKuerzel(saat.kuerzel());
		modul.setName(saat.name());
		modul.setStudiengang(studiengang);
		modulRepository.save(modul);
		return 1;
	}

	// --- Beschreibung der Saatdaten ----------------------------------------
	// Drei kleine Records plus je eine Fabrikmethode, damit die Datenliste oben
	// wie eine Tabelle lesbar bleibt und nicht in verschachtelten
	// List.of(new ...(...)) verschwindet.

	private static FakultaetSaat fakultaet(String kuerzel, String name, StudiengangSaat... studiengaenge) {
		return new FakultaetSaat(kuerzel, name, List.of(studiengaenge));
	}

	private static StudiengangSaat studiengang(String kuerzel, String name, ModulSaat... module) {
		return new StudiengangSaat(kuerzel, name, List.of(module));
	}

	private static ModulSaat modul(String kuerzel, String name) {
		return new ModulSaat(kuerzel, name);
	}

	private record FakultaetSaat(String kuerzel, String name, List<StudiengangSaat> studiengaenge) {
	}

	private record StudiengangSaat(String kuerzel, String name, List<ModulSaat> module) {
	}

	private record ModulSaat(String kuerzel, String name) {
	}
}
