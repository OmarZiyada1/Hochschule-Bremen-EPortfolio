package de.hsbremen.eportfolio.sitecontent;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.sitecontent.dto.SiteContentEntryRequest;
import de.hsbremen.eportfolio.sitecontent.dto.SiteContentEntryResponse;
import de.hsbremen.eportfolio.sitecontent.dto.SiteContentResponse;
import de.hsbremen.eportfolio.sitecontent.dto.SiteContentUpdateRequest;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die gepflegten Texte der oeffentlichen Startseite: lesen und ersetzen
 * (§3.21, §6.1).
 *
 * <p><strong>Der Servertext ueberschreibt, die i18n-Datei bleibt der
 * Rueckfall.</strong> Dieser Dienst liefert nur, was tatsaechlich gepflegt ist;
 * alles Uebrige entscheidet das Frontend mit seiner mitgelieferten Fassung.
 * Deshalb gibt es weder Seed-Daten noch eine Uebernahme des Bestands aus den
 * i18n-Dateien: der leere Zustand ist der richtige Anfangszustand und heisst
 * "die Anwendung sagt, was sie immer gesagt hat".
 *
 * <p><strong>Lesen ist PUBLIC, Schreiben ist ADMIN</strong> (§5). Der Lesepfad
 * kennt keine Rechtepruefung, aus demselben Grund wie beim
 * {@link de.hsbremen.eportfolio.masterdata.MasterDataService}: die Texte haengen
 * an keiner Ressource mit Eigentuemer, sie stehen ohnehin auf der oeffentlichen
 * Startseite. Der Schreibpfad prueft {@code mayManageSiteContent}, obwohl schon
 * die Filterkette {@code /api/admin/**} auf {@code hasRole("ADMIN")} fuehrt;
 * dieselbe Doppelung wie im
 * {@link de.hsbremen.eportfolio.masterdata.MasterDataAdminService}.
 *
 * <p><strong>Erst pruefen, dann schreiben.</strong> Der Schreibpfad geht die
 * Liste zweimal durch: einmal, um Schluessel und Platzhalter zu pruefen, und
 * erst danach, um zu speichern. Ein Rollback der Transaktion taete am Ende
 * dasselbe, aber die Zusage "eine abgelehnte Anfrage hat nichts angefasst"
 * haengt dann daran, dass niemand spaeter eine eigene Transaktion daneben
 * stellt.
 */
@Service
@Transactional
public class SiteContentService {

	/**
	 * Ein Platzhalter in der Schreibweise, die das Frontend interpoliert.
	 *
	 * <p>Absichtlich weit gefasst und nicht auf gueltige Namen eingeschraenkt:
	 * Der Ausdruck soll auch finden, was kein brauchbarer Platzhalter ist, denn
	 * genau das steht sonst spaeter woertlich auf der Seite. Nicht gierig, damit
	 * zwei Platzhalter in einem Satz zwei Treffer ergeben und nicht einen.
	 *
	 * <p><strong>Was die Pruefung leistet und wo ihre Grenze liegt.</strong>
	 * Erkannt wird die korrekte Schreibweise {@code {{name}}}. Drei Faelle liegen
	 * bewusst ausserhalb, und keiner davon ist ein Loch in der Zusage aus
	 * {@link SiteContentKey}, sondern ihre Grenze:
	 *
	 * <ul>
	 * <li>Eine verstuemmelte Schreibweise wie {@code { {year} }} zaehlt nicht als
	 * Platzhalter. An einer Stelle <em>mit</em> Pflichtplatzhalter faellt sie
	 * dadurch trotzdem auf, denn dann fehlt der geforderte. An einer Stelle
	 * <em>ohne</em> Pflichtplatzhalter geht sie durch und steht danach woertlich
	 * auf der Seite: ein sichtbarer Tippfehler im eigenen Text, kein stiller
	 * Verlust einer Zahl, und die Pflegemaske zeigt genau das an, was gespeichert
	 * wurde.</li>
	 * <li>Die Formatsyntax {@code {{year, number}}} wird abgelehnt, weil der Name
	 * dann {@code year, number} lautet und keinem geforderten entspricht. Das ist
	 * gewollt: wie eine Zahl formatiert wird, entscheidet die i18n-Vorgabe des
	 * Frontends und nicht der gepflegte Text, sonst zoege eine Formatumstellung
	 * eine Datenkorrektur nach sich.</li>
	 * <li>Die Verschachtelung {@code $t(anderer.schluessel)}, mit der i18next
	 * einen zweiten Schluessel einsetzt, wird nicht geprueft. Sie ist harmlos
	 * (gepflegt wird ausschliesslich von ADMIN, und React maskiert die Ausgabe),
	 * aber sie ist auch nichts, was diese API zusagt: ob der gepflegte Text
	 * ueberhaupt interpoliert oder als reiner Text ausgegeben wird, entscheidet
	 * das Frontend beim Einbau.</li>
	 * </ul>
	 */
	private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(.*?)\\}\\}", Pattern.DOTALL);

	private final SiteContentRepository siteContentRepository;

	private final ProjectPermissionService permissions;

	public SiteContentService(SiteContentRepository siteContentRepository,
			ProjectPermissionService permissions) {
		this.siteContentRepository = siteContentRepository;
		this.permissions = permissions;
	}

	/**
	 * {@code GET /api/site-content}, <strong>200</strong> (PUBLIC).
	 *
	 * <p>Solange nichts gepflegt ist, ist die Liste leer. Das ist kein 404: die
	 * Sammlung gibt es, sie ist nur ohne Inhalt, und ein 404 zwaenge den Client
	 * dazu, den Regelfall als Fehler zu behandeln (§6.3).
	 */
	@Transactional(readOnly = true)
	public SiteContentResponse read() {
		return toResponse();
	}

	/**
	 * {@code PUT /api/admin/site-content}, <strong>200</strong> (ADMIN).
	 *
	 * <p>Ersetzt die uebergebenen Schluessel vollstaendig und laesst alle
	 * uebrigen unberuehrt. Die Antwort ist der neue Gesamtstand, also dieselbe
	 * Form wie beim Lesen: die Pflegemaske braucht danach genau das, und ein
	 * zweiter Request dafuer koennte einen Stand zeigen, der zwischenzeitlich
	 * schon wieder ein anderer ist.
	 *
	 * @throws AccessDeniedException wenn die Rolle nicht ADMIN ist (403)
	 * @throws ValidationException   bei unbekanntem oder doppeltem Schluessel und
	 *                               bei falscher Platzhalterbelegung (400)
	 */
	public SiteContentResponse replace(AuthenticatedUser user, SiteContentUpdateRequest request) {
		requireSiteContentAdministration(user);

		Map<SiteContentKey, SiteContentEntryRequest> byKey = validate(request.entries());

		// Der Bestand wird einmal geladen und nicht je Eintrag und Sprache
		// einzeln gesucht: bei allen fuenfzehn Stellen waeren das dreissig
		// Abfragen fuer einen Vorgang, der ohnehin gleich darauf den ganzen
		// Bestand liest. Die Abbildung darf waehrend der Schleife veralten, ohne
		// dass es etwas ausmacht, weil jede Stelle hoechstens einmal vorkommt:
		// darueber wacht validate mit der Doppelpruefung.
		Map<SiteContentKey, Map<String, SiteContent>> stored = load();
		byKey.forEach((key, entry) -> {
			apply(stored, key, SiteContent.LOCALE_DE, entry.valueDe());
			apply(stored, key, SiteContent.LOCALE_EN, entry.valueEn());
		});
		siteContentRepository.flush();

		return toResponse();
	}

	// ==================================================================
	// Pruefung
	// ==================================================================

	/**
	 * Prueft die ganze Liste, bevor eine Zeile geschrieben wird, und loest sie
	 * dabei in Enum-Konstanten auf.
	 *
	 * <p>Die Reihenfolge des Bodys bleibt erhalten (verkettete Abbildung), damit
	 * eine Fehlermeldung auf denselben Index zeigt, den der Aufrufer geschickt
	 * hat.
	 */
	private Map<SiteContentKey, SiteContentEntryRequest> validate(
			List<SiteContentEntryRequest> entries) {

		Map<SiteContentKey, SiteContentEntryRequest> byKey = new LinkedHashMap<>();

		for (int index = 0; index < entries.size(); index++) {
			SiteContentEntryRequest entry = entries.get(index);
			SiteContentKey key = requireKnownKey(entry.key(), index);

			if (byKey.put(key, entry) != null) {
				throw invalid(field(index, "key"), "Der Schluessel \"" + entry.key()
						+ "\" kommt mehrfach vor. Welche Fassung gewaenne, haengt dann an der "
						+ "Reihenfolge im Body.");
			}

			requirePlaceholders(key, entry.valueDe(), field(index, "valueDe"));
			requirePlaceholders(key, entry.valueEn(), field(index, "valueEn"));
		}

		return byKey;
	}

	private SiteContentKey requireKnownKey(String i18nKey, int index) {
		Optional<SiteContentKey> key = SiteContentKey.fromI18nKey(i18nKey);
		if (key.isEmpty()) {
			throw invalid(field(index, "key"), "Die Startseite kennt den Schluessel \"" + i18nKey
					+ "\" nicht. Pflegbar sind ausschliesslich die Schluessel, die "
					+ "GET /api/site-content fuehrt.");
		}
		return key.get();
	}

	/**
	 * Der gespeicherte Text muss genau die Platzhalter tragen, die die Stelle
	 * verlangt: keinen fehlenden und keinen ueberzaehligen.
	 *
	 * <p>Geprueft wird beim Speichern und nicht erst beim Anzeigen. Ein
	 * fehlender Platzhalter laesst die Zahl wortlos aus der Seite verschwinden,
	 * ein ueberzaehliger steht woertlich darin; beides faellt in der Anzeige
	 * niemandem auf, der den Text gerade eingegeben hat.
	 *
	 * <p>Ein leerer Wert wird nicht geprueft, denn er loescht die Zeile und wird
	 * nie angezeigt.
	 */
	private void requirePlaceholders(SiteContentKey key, String value, String field) {
		if (isBlank(value)) {
			return;
		}

		Set<String> found = new LinkedHashSet<>();
		Matcher matcher = PLACEHOLDER.matcher(value);
		while (matcher.find()) {
			found.add(matcher.group(1).trim());
		}

		Set<String> required = Set.copyOf(key.requiredPlaceholders());
		if (found.equals(required)) {
			return;
		}

		List<String> missing = key.requiredPlaceholders().stream()
				.filter(name -> !found.contains(name))
				.toList();
		List<String> unexpected = found.stream()
				.filter(name -> !required.contains(name))
				.toList();

		StringBuilder message = new StringBuilder("Der Text zu \"" + key.i18nKey() + "\" ");
		if (!missing.isEmpty()) {
			message.append("muss ").append(braced(missing)).append(" enthalten");
		}
		if (!missing.isEmpty() && !unexpected.isEmpty()) {
			message.append(" und ");
		}
		if (!unexpected.isEmpty()) {
			message.append("darf ").append(braced(unexpected))
					.append(" nicht enthalten: Platzhalter, die niemand fuellt, stehen "
							+ "woertlich auf der Seite");
		}
		throw invalid(field, message.append(".").toString());
	}

	/** Platzhalternamen so schreiben, wie sie im Text stehen muessen. */
	private String braced(List<String> names) {
		return names.stream()
				.map(name -> "{{" + name + "}}")
				.reduce((first, second) -> first + " und " + second)
				.orElseThrow();
	}

	// ==================================================================
	// Schreiben und Lesen
	// ==================================================================

	/**
	 * Setzt eine Sprache einer Stelle. Ein leerer Wert loescht die Zeile, ein
	 * gefuellter legt sie an oder schreibt sie um.
	 *
	 * <p>Der Text wird nicht getrimmt: fuehrende oder folgende Leerzeichen
	 * gehoeren zur Formatierung, und ein Text, der nur aus ihnen besteht, gilt
	 * ohnehin als leer.
	 *
	 * @param stored der einmal geladene Bestand aus {@link #load()}, aus dem die
	 *               vorhandene Zeile kommt, statt sie einzeln nachzuschlagen
	 * @param key    die Stelle auf der Startseite
	 * @param locale {@link SiteContent#LOCALE_DE} oder {@link SiteContent#LOCALE_EN}
	 * @param value  der neue Text; leer loescht die Zeile
	 */
	private void apply(Map<SiteContentKey, Map<String, SiteContent>> stored, SiteContentKey key,
			String locale, String value) {

		SiteContent existing = stored.getOrDefault(key, Map.of()).get(locale);

		if (isBlank(value)) {
			if (existing != null) {
				siteContentRepository.delete(existing);
			}
			return;
		}

		if (existing != null) {
			existing.setValue(value);
		} else {
			siteContentRepository.save(new SiteContent(key, locale, value));
		}
	}

	/**
	 * Der ganze Bestand, aufgeschluesselt nach Stelle und Sprache.
	 *
	 * <p>Eine einzige Abfrage: die Tabelle hat hoechstens dreissig Zeilen
	 * (fuenfzehn Stellen mal zwei Sprachen), und beide Aufrufer brauchen
	 * ohnehin mehr als eine davon. Zurueckgegeben werden die verwalteten
	 * Entities und nicht ihre Werte, damit der Schreibpfad daraus unmittelbar
	 * aendern und loeschen kann.
	 */
	private Map<SiteContentKey, Map<String, SiteContent>> load() {
		Map<SiteContentKey, Map<String, SiteContent>> byKey = new EnumMap<>(SiteContentKey.class);
		for (SiteContent row : siteContentRepository.findAll()) {
			byKey.computeIfAbsent(row.getContentKey(), key -> new LinkedHashMap<>())
					.put(row.getLocale(), row);
		}
		return byKey;
	}

	/**
	 * Der Gesamtstand: je Schluessel eine Zeile der Antwort, sobald mindestens
	 * eine Sprache gepflegt ist. Die Reihenfolge ist die der Abschnitte auf der
	 * Seite, also die Deklarationsreihenfolge des Enums.
	 */
	private SiteContentResponse toResponse() {
		Map<SiteContentKey, Map<String, SiteContent>> stored = load();

		List<SiteContentEntryResponse> entries = new ArrayList<>();
		for (SiteContentKey key : SiteContentKey.values()) {
			Map<String, SiteContent> values = stored.get(key);
			if (values == null || values.isEmpty()) {
				continue;
			}
			entries.add(new SiteContentEntryResponse(key.i18nKey(),
					valueOf(values, SiteContent.LOCALE_DE),
					valueOf(values, SiteContent.LOCALE_EN)));
		}

		return new SiteContentResponse(entries);
	}

	/** Der Text einer Sprache oder {@code null}, wenn sie nicht gepflegt ist. */
	private String valueOf(Map<String, SiteContent> values, String locale) {
		SiteContent row = values.get(locale);
		return row == null ? null : row.getValue();
	}

	// ==================================================================
	// Gemeinsame Hilfsmittel
	// ==================================================================

	private void requireSiteContentAdministration(AuthenticatedUser user) {
		if (!permissions.mayManageSiteContent(user)) {
			throw new AccessDeniedException(
					"Die Texte der Startseite pflegt ausschliesslich die Administration (§5).");
		}
	}

	/**
	 * Feldname im Fehlertext, in derselben Schreibweise wie bei der
	 * Bean-Validation ({@code entries[0].valueDe}). So sagt die Meldung, welcher
	 * Eintrag gemeint ist, ohne dass das Envelope aus §6.2 ein weiteres Feld
	 * braucht.
	 */
	private String field(int index, String name) {
		return "entries[" + index + "]." + name;
	}

	private ValidationException invalid(String field, String message) {
		return new ValidationException(ErrorCodes.VALIDATION_FAILED, field + ": " + message);
	}

	private boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
