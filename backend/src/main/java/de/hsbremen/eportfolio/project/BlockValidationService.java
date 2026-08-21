package de.hsbremen.eportfolio.project;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Prueft Inhaltsbloecke gegen das Block-Schema (API-Contract §2.5):
 * content.type muss zum type passen, typabhaengige Pflichtfelder muessen
 * gesetzt sein, Marks und ihre Attribute muessen in der Liste aus §2.5 stehen,
 * und fuer VIDEO/EMBED wird die Provider-Allowlist serverseitig durchgesetzt.
 * Verstoesse fuehren zu einer {@link ValidationException}, die als HTTP 400
 * mit dem Envelope aus §6.2 beantwortet wird.
 *
 * <p><strong>Zwei Fehlercodes, nicht einer.</strong> Ein unpassender Inhalt
 * ergibt {@code BLOCK_CONTENT_INVALID}, eine gesperrte Quelle dagegen
 * {@code EMBED_PROVIDER_NOT_ALLOWED}. §6.2 fuehrt beide getrennt, und sie
 * verlangen Verschiedenes: den einen behebt eine Korrektur am Block, den
 * anderen nur eine andere Quelle. Bis KAN-18 lieferte diese Klasse fuer beides
 * denselben Code.
 *
 * <p><strong>Der Server schreibt nicht in das Dokument</strong> (§3.4). Wo ein
 * Attribut optional ist ({@code IMAGE.width}, {@code GALLERY.columns}),
 * akzeptiert diese Klasse sein Fehlen und ergaenzt nichts:
 * {@code Block.content} wird unveraendert gespeichert, und eine serverseitige
 * Normalisierung erzeugte eine Fassung, die die Editor-Seite nie geschickt
 * hat. §2.5 nennt fuer beide nur die zulaessigen Stufen und keinen
 * Vorgabewert; welche Breite ein Bild ohne Angabe bekommt, entscheidet
 * deshalb die Darstellung und nicht der Server.
 *
 * <p><strong>Die Kennungen C1, C3 und C15</strong> in diesem Javadoc benennen
 * Punkte aus der Befundliste zu KAN-72 (dort in der Beschreibung ausgefuehrt);
 * sie stehen nicht im Contract und sind ausserhalb dieses Tickets nicht
 * aufloesbar.
 *
 * <p><strong>Gestrichene Attribute werden aktiv abgewiesen</strong>, nicht nur
 * nicht mehr gelesen (KAN-72, Befund C1). {@code AUDIO.src}, {@code GALLERY.fileIds} und
 * eine URL am {@code VIDEO}-Block ergeben 400, auch neben einer gueltigen
 * Quelle. Ohne dieses Verbot bliebe die Streichung kosmetisch: ein Dokument
 * aus v50 liefe unveraendert weiter, der Wert laege dauerhaft in der
 * Datenbank, und jeder Renderer faende ihn weiterhin vor.
 */
@Service
public class BlockValidationService {

	/** Zulaessige ProseMirror-Knotentypen je BlockType (LIST deckt beide Listenarten ab). */
	private static final Map<BlockType, Set<String>> ALLOWED_NODE_TYPES = Map.ofEntries(
			Map.entry(BlockType.HEADING, Set.of("heading")),
			Map.entry(BlockType.TEXT, Set.of("paragraph")),
			Map.entry(BlockType.LIST, Set.of("bulletList", "orderedList")),
			Map.entry(BlockType.QUOTE, Set.of("blockquote")),
			Map.entry(BlockType.CODE, Set.of("codeBlock")),
			Map.entry(BlockType.FORMULA, Set.of("mathBlock")),
			Map.entry(BlockType.TABLE, Set.of("table")),
			Map.entry(BlockType.DIVIDER, Set.of("horizontalRule")),
			Map.entry(BlockType.IMAGE, Set.of("imageBlock")),
			Map.entry(BlockType.GALLERY, Set.of("galleryBlock")),
			Map.entry(BlockType.VIDEO, Set.of("videoBlock")),
			Map.entry(BlockType.AUDIO, Set.of("audioBlock")),
			Map.entry(BlockType.DOCUMENT, Set.of("documentBlock")),
			Map.entry(BlockType.EMBED, Set.of("embedBlock")));

	/** Erlaubte Embed-Hosts je Provider; nur https. Seit Contract v52 auch in §2.5. */
	private static final Map<String, Set<String>> ALLOWED_EMBED_HOSTS = Map.of(
			"youtube", Set.of("www.youtube.com", "youtube.com", "www.youtube-nocookie.com"),
			"vimeo", Set.of("player.vimeo.com"),
			"figma", Set.of("www.figma.com"),
			"codepen", Set.of("codepen.io"),
			"gist", Set.of("gist.github.com"));

	/**
	 * Provider-Allowlist fuer VIDEO, enger als die fuer EMBED. §2.5 fuehrt sie
	 * seit Contract v52 ausdruecklich zweigeteilt: bei VIDEO leitet der Server
	 * die Einbettungs-URL aus provider und videoId selbst ab, und diese
	 * Ableitung gibt es nur fuer die beiden Videoanbieter.
	 */
	private static final Set<String> VIDEO_PROVIDERS = Set.of("youtube", "vimeo");

	/**
	 * Zulaessige videoId-Formate je Provider. Bewusst restriktiv, weil die
	 * Embed-URL serverseitig aus der videoId aufgebaut wird und keine
	 * URL-Metazeichen enthalten darf.
	 */
	private static final Map<String, Pattern> VIDEO_ID_PATTERNS = Map.of(
			"youtube", Pattern.compile("[A-Za-z0-9_-]{1,64}"),
			"vimeo", Pattern.compile("\\d{1,32}"));

	/** Die zehn Marks aus §2.5, abschliessend. */
	private static final Set<String> ALLOWED_MARKS = Set.of(
			"bold", "italic", "underline", "strike", "code",
			"link", "textStyle", "highlight", "superscript", "subscript");

	/**
	 * Die fuenf Blocktypen, in denen §2.5 Marks zulaesst. Ein {@code marks}-Feld
	 * in einem Medien- oder Strukturblock ergibt 400: dort gibt es keinen
	 * Textknoten, den es auszeichnen koennte.
	 */
	private static final Set<BlockType> MARKABLE_TYPES = Set.of(
			BlockType.HEADING, BlockType.TEXT, BlockType.LIST,
			BlockType.QUOTE, BlockType.TABLE);

	/**
	 * Die neun Farbrollen aus §2.5 fuer {@code textStyle} und
	 * {@code highlight}. Ein Hex-Wert waere im Dunkelmodus derselbe Ton auf
	 * dunklem Grund und verfehlte den Kontrast von 4,5:1; ausserdem laege er
	 * ausserhalb der Tokenschicht und waere nachtraeglich nur per Migration
	 * aenderbar.
	 *
	 * <p>Die vier Rollen {@code brown}, {@code orange}, {@code purple} und
	 * {@code pink} sind mit v63 hinzugekommen. Der Bestand ist davon nicht
	 * betroffen: eine erweiterte Palette laesst nur mehr zu und entwertet
	 * nichts, deshalb braucht sie auch keine Schemaversion.
	 */
	private static final Set<String> COLOR_ROLES = Set.of(
			"neutral", "blue", "green", "amber", "red",
			"brown", "orange", "purple", "pink");

	/**
	 * Zulaessige Schemata in {@code link.href}. Seit Contract v54 in §2.5
	 * gefuehrt; eingefuehrt mit KAN-72 (Befund C3).
	 */
	private static final Set<String> ALLOWED_LINK_SCHEMES = Set.of("http", "https", "mailto");

	/**
	 * Zulaessige Ueberschriftenebenen (§2.5 seit v63): 1 bis 6.
	 *
	 * <p>Der gespeicherte Wert beschreibt die <em>Gliederung des Beitrags</em>
	 * und nicht das HTML-Element, in dem er landet. Die Ebene 1 der Seite
	 * bleibt der Projekttitel aus {@code Project.title} (§3.3); die Anzeige
	 * schiebt jede gespeicherte Ebene um genau eine Stufe nach unten (1 wird
	 * {@code h2} und so fort). Die frueher gueltige Verengung auf 2 und 3
	 * verhinderte keinen uebersprungenen Sprung, sie verhinderte nur die
	 * Gliederung laengerer Beitraege.
	 */
	private static final Set<Integer> HEADING_LEVELS = Set.of(1, 2, 3, 4, 5, 6);

	/**
	 * Zulaessige Ausrichtungen am {@code HEADING} (§2.5 seit v63).
	 *
	 * <p>{@code justify} fehlt bewusst und bleibt dem Absatz vorbehalten:
	 * Blocksatz an einer ein- oder zweizeiligen Ueberschrift erzeugt
	 * Wortabstaende, die den Zeilenfall zerreissen, ohne einen Satzspiegel zu
	 * gewinnen. Am {@code paragraph} bleibt {@code textAlign} dagegen freie
	 * Anzeigeinformation und wird hier nicht geprueft.
	 */
	private static final Set<String> HEADING_TEXT_ALIGNMENTS = Set.of("left", "center", "right");

	/** Zulaessige Bildbreiten in Prozent der Textspalte (§2.5). */
	private static final Set<Integer> IMAGE_WIDTHS = Set.of(100, 75, 50);

	/** Zulaessige Spaltenzahlen der Galerie (§2.5). */
	private static final Set<Integer> GALLERY_COLUMNS = Set.of(2, 3);

	/**
	 * Obergrenze der Schachtelungstiefe im Mark-Durchlauf. Ein Dokument aus
	 * dem Editor erreicht sie nicht (eine Tabelle mit Absatz und Liste liegt
	 * bei fuenf bis sieben Ebenen), ein von Hand gebautes JSON schon: ohne
	 * Grenze liesse sich der Durchlauf mit wenigen Kilobyte Eingabe in einen
	 * Stapelueberlauf treiben.
	 */
	private static final int MAX_NODE_DEPTH = 20;

	public void validate(List<Block> blocks) {
		for (int i = 0; i < blocks.size(); i++) {
			validateBlock(blocks.get(i), i);
		}
	}

	public void validateBlock(Block block, int index) {
		validate(block.getType(), block.getContent(), index);
	}

	/**
	 * Prueft Typ und Inhalt eines Blocks, ohne dafuer eine {@link Block}-Instanz
	 * zu verlangen.
	 *
	 * <p>{@code PUT /api/projects/{id}/blocks} prueft die gesamte eingeschickte
	 * Liste, <em>bevor</em> es die erste Zeile anfasst: sonst liesse ein
	 * ungueltiger Block am Ende der Liste ein halb geaendertes Projekt zurueck.
	 * Zu diesem Zeitpunkt gibt es die Entities noch nicht, wohl aber Typ und
	 * Inhalt aus dem Request.
	 *
	 * <p><strong>Erst der Wurzelknoten, dann die Marks.</strong> Ein Block, der
	 * schon am Typ scheitert, erzeugt keine zweite Meldung ueber ein Mark.
	 *
	 * @param index Position in der eingeschickten Liste, damit die Meldung sagt,
	 *              welcher Block gemeint ist
	 */
	public void validate(BlockType type, JsonNode content, int index) {
		if (type == null) {
			throw error(index, "type fehlt");
		}
		if (content == null || !content.isObject()) {
			throw error(index, "content fehlt oder ist kein Objekt");
		}
		String nodeType = content.path("type").asText("");
		if (!ALLOWED_NODE_TYPES.get(type).contains(nodeType)) {
			throw error(index, "content.type '" + nodeType + "' passt nicht zu type " + type);
		}
		validateRootAttributes(type, content.path("attrs"), index);
		walkMarks(content, type, index, 1);
	}

	/**
	 * Die typabhaengigen {@code attrs} des Wurzelknotens (§2.5). Was hier nicht
	 * genannt ist, prueft der Server nicht: {@code caption}, {@code alt} am
	 * Bild und {@code textAlign} sind freie Anzeigeinformation.
	 */
	private void validateRootAttributes(BlockType type, JsonNode attrs, int index) {
		switch (type) {
			case HEADING -> {
				requireIntFrom(index, attrs, "level", HEADING_LEVELS,
						"HEADING braucht attrs.level 1 bis 6: gespeichert wird die Gliederungsebene, "
								+ "angezeigt eine Stufe tiefer, weil die Ebene 1 der Seite der "
								+ "Projekttitel ist (§2.5, §3.3)");
				requireOptionalTextFrom(index, attrs, "textAlign", HEADING_TEXT_ALIGNMENTS,
						"HEADING: attrs.textAlign kennt left, center und right, aber kein justify "
								+ "(§2.5)");
			}
			case FORMULA -> requireText(index, type, attrs, "latex");
			case IMAGE -> {
				requireFileId(index, type, attrs, "fileId");
				requireOptionalIntFrom(index, attrs, "width", IMAGE_WIDTHS,
						"IMAGE: attrs.width kennt genau 100, 75 und 50 (§2.5)");
			}
			case GALLERY -> {
				forbidAttribute(index, attrs, "fileIds",
						"GALLERY fuehrt seit §2.5 attrs.items als Array aus { fileId, alt } "
								+ "und kein attrs.fileIds mehr");
				validateGalleryItems(index, attrs);
				requireOptionalIntFrom(index, attrs, "columns", GALLERY_COLUMNS,
						"GALLERY: attrs.columns kennt genau 2 und 3 (§2.5)");
			}
			case VIDEO -> validateVideo(index, attrs);
			case EMBED -> checkEmbed(index, type, attrs, ALLOWED_EMBED_HOSTS.keySet());
			case AUDIO -> {
				forbidAttribute(index, attrs, "src",
						"AUDIO kennt seit §2.5 nur die hochgeladene Datei; eine freie Fremd-URL "
								+ "waere beim Rendern ein ungepruefter Abruf gegen einen "
								+ "beliebigen Host");
				requireFileId(index, type, attrs, "fileId");
			}
			case DOCUMENT -> {
				requireFileId(index, type, attrs, "fileId");
				requireText(index, type, attrs, "fileName");
				if (attrs.path("size").asLong(0) <= 0) {
					throw error(index, "DOCUMENT braucht attrs.size in Bytes (> 0)");
				}
			}
			// TEXT, LIST, QUOTE, CODE, TABLE, DIVIDER haben keine Pflicht-Attribute.
			default -> { /* nichts zu pruefen */ }
		}
	}

	/**
	 * {@code GALLERY.items} ist ein nicht leeres Array aus Objekten mit
	 * {@code fileId} in UUID-Form und vorhandenem {@code alt} (§2.5).
	 *
	 * <p><strong>Ein leeres {@code alt} ist zulaessig, ein fehlendes nicht.</strong>
	 * Die leere Zeichenkette ist die ausdrueckliche Aussage „dieses Bild ist
	 * schmueckend", ein fehlendes Feld dagegen ein vergessener Alternativtext.
	 * Wer sich eine Galerie vorlesen laesst, erfaehrt sonst zum dritten Bild
	 * nichts (§2.5 beruft sich auf WCAG 2.2, Erfolgskriterium 1.1.1). Ein
	 * gemeinsamer {@code caption} beschreibt die Gruppe und ersetzt das nicht.
	 */
	private void validateGalleryItems(int index, JsonNode attrs) {
		JsonNode items = attrs.path("items");
		if (!items.isArray() || items.isEmpty()) {
			throw error(index, "GALLERY braucht attrs.items als nicht-leeres Array aus "
					+ "{ fileId, alt } (§2.5)");
		}
		for (int position = 0; position < items.size(); position++) {
			JsonNode item = items.get(position);
			if (!item.isObject()) {
				throw error(index, "GALLERY: attrs.items[" + position
						+ "] ist kein Objekt mit fileId und alt");
			}
			requireFileId(index, BlockType.GALLERY, "items[" + position + "].fileId",
					item.path("fileId"));
			JsonNode alt = item.path("alt");
			if (!alt.isTextual()) {
				throw error(index, "GALLERY: attrs.items[" + position + "] braucht ein alt; "
						+ "leer ist zulaessig und heisst schmueckend, fehlend nicht (§2.5)");
			}
		}
	}

	/**
	 * {@code VIDEO} traegt <strong>genau eine</strong> Quelle (§2.5, seit
	 * Contract v51): entweder die hochgeladene Datei ueber {@code fileId} oder
	 * die Einbettung ueber {@code provider} und {@code videoId}, nie beides und
	 * nie keines.
	 *
	 * <p><strong>Keine URL, in keinem Feld.</strong> §2.5 haelt fest, dass ein
	 * VIDEO-Block keine URL speichert: persistiert werden ausschliesslich
	 * provider und videoId, die Einbettungs-URL wird beim Rendern abgeleitet.
	 * Weil der Server den Inhalt unveraendert speichert, ueberlebte ein
	 * mitgeschicktes {@code embedUrl} sonst genau die Pruefung, die es
	 * verhindern soll, und landete beim Rendern in einem iframe (Klaerung zu
	 * KAN-72).
	 */
	private void validateVideo(int index, JsonNode attrs) {
		forbidAttribute(index, attrs, "embedUrl",
				"VIDEO speichert keine URL (§2.5): die Einbettung entsteht aus provider und "
						+ "videoId, eine vom Client gelieferte Fremd-URL landete beim Rendern "
						+ "ungeprueft in einem iframe");
		forbidAttribute(index, attrs, "src",
				"VIDEO speichert keine URL (§2.5): die hochgeladene Datei steht in fileId");

		boolean hasFile = attrs.hasNonNull("fileId");
		boolean hasEmbed = attrs.hasNonNull("provider") || attrs.hasNonNull("videoId");
		if (hasFile && hasEmbed) {
			throw error(index, "VIDEO traegt entweder attrs.fileId oder attrs.provider mit "
					+ "attrs.videoId, nie beides (§2.5)");
		}
		if (!hasFile && !hasEmbed) {
			throw error(index, "VIDEO braucht eine Quelle: attrs.fileId fuer die hochgeladene "
					+ "Datei oder attrs.provider mit attrs.videoId fuer die Einbettung (§2.5)");
		}

		if (hasFile) {
			requireFileId(index, BlockType.VIDEO, attrs, "fileId");
			return;
		}

		String provider = attrs.path("provider").asText("");
		if (!VIDEO_PROVIDERS.contains(provider)) {
			throw providerError(index, "VIDEO: provider '" + provider
					+ "' ist nicht erlaubt (zulaessig: youtube, vimeo)");
		}
		String videoId = attrs.path("videoId").asText("");
		if (videoId.isBlank()) {
			throw error(index, "VIDEO braucht attrs.videoId");
		}
		if (!VIDEO_ID_PATTERNS.get(provider).matcher(videoId).matches()) {
			throw error(index, "VIDEO: videoId hat ein ungueltiges Format fuer Provider '"
					+ provider + "'");
		}
	}

	// ------------------------------------------------------------------
	// Marks (§2.5, Befund C3)
	// ------------------------------------------------------------------

	/**
	 * Steigt durch den Knotenbaum eines Blocks und prueft ausschliesslich
	 * {@code marks} (§2.5).
	 *
	 * <p>Eingefuehrt mit KAN-72 (Befund C3), in §2.5 nachgetragen mit Contract
	 * v54.
	 *
	 * <p><strong>Warum die Pruefung im Server liegt und nicht im Renderer.</strong>
	 * §2.5 begruendet dasselbe schon fuer die Provider-Allowlist: eine reine
	 * Frontend-Pruefung laesst sich ueber direkte API-Aufrufe umgehen. Dazu
	 * kommt zweierlei. Den Blockinhalt liest die oeffentliche Detailseite, der
	 * PDF-Export, die Vorschau im Editor und jeder kuenftige Ausgabeweg; ein
	 * Filter allein im Renderer schuetzt nur diesen einen, und der erste, der
	 * ihn vergisst, macht die Luecke wieder auf. Und der Datenbestand bliebe
	 * vergiftet: ein Renderer-Filter versteckt den Wert, loescht ihn aber
	 * nicht, er wandert in jeden Export, jede Sicherung und die Historie.
	 *
	 * <p>Die Methode kennt nur zwei Strukturmerkmale, {@code marks} und
	 * {@code content}, und keine Knotentypen. Sie bleibt damit gueltig, wenn
	 * KAN-10 das Tiptap-Schema festzurrt und die Knotentyp-Grammatik in §2.5
	 * nachtraegt (Befund C2 zu KAN-72, dort ausdruecklich abgegrenzt).
	 *
	 * <p><strong>Getragene Grenze bis dahin:</strong> weil keine
	 * Knotentyp-Grammatik existiert, deckt {@code ALLOWED_NODE_TYPES} nur den
	 * Wurzelknoten ab. Ein von §2.5 ausgeschlossener Knoten wie {@code taskList}
	 * innerhalb einer Liste oder Tabellenzelle laeuft durch; abgewiesen wird er
	 * erst, wenn die Grammatik im Contract steht.
	 *
	 * @param depth Tiefe des aktuellen Knotens, der Wurzelknoten steht auf 1
	 */
	private void walkMarks(JsonNode node, BlockType type, int index, int depth) {
		if (depth > MAX_NODE_DEPTH) {
			throw error(index, "content ist tiefer als " + MAX_NODE_DEPTH
					+ " Ebenen verschachtelt (§2.5)");
		}
		JsonNode marks = node.path("marks");
		if (!marks.isMissingNode() && !marks.isNull()) {
			validateMarks(marks, type, index);
		}
		JsonNode children = node.path("content");
		if (children.isArray()) {
			for (JsonNode child : children) {
				if (child.isObject()) {
					walkMarks(child, type, index, depth + 1);
				}
			}
		}
	}

	/**
	 * Die {@code marks} eines einzelnen Knotens (§2.5). Ein {@code marks}, das
	 * kein Array ist, ergibt 400 wie jeder andere Formfehler: ProseMirror
	 * schreibt an dieser Stelle immer ein Array, und ein Objekt oder eine Zahl
	 * kaeme nur aus einem von Hand gebauten Dokument.
	 */
	private void validateMarks(JsonNode marks, BlockType type, int index) {
		if (!MARKABLE_TYPES.contains(type)) {
			throw error(index, type + " kennt keine marks: §2.5 laesst sie nur in HEADING, "
					+ "TEXT, LIST, QUOTE und TABLE zu");
		}
		if (!marks.isArray()) {
			throw error(index, "marks muss ein Array sein");
		}
		for (JsonNode mark : marks) {
			if (!mark.isObject()) {
				throw error(index, "marks enthaelt einen Eintrag, der kein Objekt ist");
			}
			String markType = mark.path("type").asText("");
			if (!ALLOWED_MARKS.contains(markType)) {
				throw error(index, "mark '" + markType + "' steht nicht in §2.5 (zulaessig: "
						+ String.join(", ", ALLOWED_MARKS.stream().sorted().toList()) + ")");
			}
			JsonNode attrs = mark.path("attrs");
			switch (markType) {
				case "link" -> requireSafeHref(index, attrs);
				case "textStyle", "highlight" -> requireColorRole(index, markType, attrs);
				default -> { /* bold, italic, underline, strike, code, sup, sub: ohne attrs */ }
			}
		}
	}

	/**
	 * Protokollfilter auf {@code link.href} (§2.5, Befund C3): zulaessig sind
	 * ausschliesslich http, https und mailto.
	 *
	 * <p><strong>Was ohne diesen Filter geschieht.</strong> Ein Skript-Link
	 * wird gespeichert, beim Lesen unveraendert zurueckgegeben und landet auf
	 * der oeffentlichen Projektdetailseite, die ohne Anmeldung erreichbar ist.
	 * Das ist eine gespeicherte Einschleusung: der Schadcode liegt dauerhaft in
	 * der Datenbank, wird jeder Besucherin ausgeliefert und laeuft nach einem
	 * gewoehnlichen Klick im Ursprung des Portals, also mit der Sitzung der
	 * klickenden Person und gegebenenfalls mit Redaktions- oder
	 * Administrationsrechten.
	 *
	 * <p>Die Reihenfolge hat einen Grund. Zuerst faellt alles mit Steuerzeichen
	 * oder Leerraum vor dem Doppelpunkt, denn manche Browser ziehen ein
	 * zerteiltes Schema wieder zusammen und machen aus {@code java&#92;tscript:}
	 * doch noch ein ausfuehrbares. Erst danach wird getrimmt und geparst;
	 * {@code URI.create} wirft bei Leerzeichen eine
	 * {@link IllegalArgumentException}, die hier zu 400 wird und nicht zu 500.
	 * Verglichen wird kleingeschrieben, weil gemischte Schreibweise derselbe
	 * Angriff ist.
	 *
	 * <p>Eine Adresse ohne Schema wird ebenfalls abgewiesen, relativ wie
	 * protokollrelativ: ein Portfolio-Beitrag verlinkt nach aussen oder gar
	 * nicht, und {@code //fremde.tld} waere sonst der bequeme Weg an der
	 * Pruefung vorbei. {@code target} und {@code rel} prueft der Server nicht;
	 * {@code rel="noopener noreferrer"} setzt der Renderer.
	 */
	private void requireSafeHref(int index, JsonNode attrs) {
		JsonNode href = attrs.path("href");
		if (!href.isTextual() || href.asText().isBlank()) {
			throw error(index, "mark 'link' braucht attrs.href");
		}
		String raw = href.asText();
		int colon = raw.indexOf(':');
		String prefix = colon < 0 ? raw : raw.substring(0, colon);
		for (int i = 0; i < prefix.length(); i++) {
			char c = prefix.charAt(i);
			if (c < 0x20 || c == 0x7F || Character.isWhitespace(c)) {
				throw error(index, "mark 'link': attrs.href traegt Steuerzeichen oder Leerraum "
						+ "vor dem Doppelpunkt");
			}
		}

		String scheme;
		try {
			scheme = URI.create(raw.trim()).getScheme();
		} catch (IllegalArgumentException e) {
			throw error(index, "mark 'link': attrs.href ist keine gueltige URL");
		}
		if (scheme == null || !ALLOWED_LINK_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))) {
			throw error(index, "mark 'link': attrs.href braucht das Schema http, https oder "
					+ "mailto (§2.5)");
		}
	}

	/**
	 * {@code textStyle} und {@code highlight} fuehren in {@code attrs.color}
	 * einen Rollennamen aus {@code neutral}, {@code blue}, {@code green},
	 * {@code amber} und {@code red} (§2.5).
	 *
	 * <p>Dass ein fehlendes {@code color} abgewiesen wird, folgt woertlich aus
	 * §2.5: „Keine Farbe heisst: das Mark fehlt." Der Renderer verwirft
	 * zusaetzlich beim Lesen, was er nicht kennt; beide Riegel sind gewollt,
	 * denn der Bestand aus v50 kann Werte tragen, die der Schreibweg kuenftig
	 * zurueckweist.
	 */
	private void requireColorRole(int index, String markType, JsonNode attrs) {
		JsonNode color = attrs.path("color");
		if (!color.isTextual() || !COLOR_ROLES.contains(color.asText())) {
			throw error(index, "mark '" + markType + "': attrs.color braucht einen Rollennamen "
					+ "aus " + String.join(", ", COLOR_ROLES.stream().sorted().toList())
					+ " und keinen Farbwert (§2.5)");
		}
	}

	// ------------------------------------------------------------------
	// Einbettung
	// ------------------------------------------------------------------

	/**
	 * Leitet die Embed-URL eines VIDEO-Blocks serverseitig aus provider und
	 * videoId ab. Eine vom Client mitgeschickte embedUrl wird bewusst nicht
	 * uebernommen; die videoId ist zuvor gegen {@link #VIDEO_ID_PATTERNS}
	 * validiert.
	 *
	 * <p><strong>Ohne Aufrufer im Backend</strong>, und das bleibt mit KAN-72
	 * so: die Embed-URL baut der Lesepfad im Frontend (KAN-10, {@code
	 * providers.ts}). Die Methode steht hier als die eine verbindliche
	 * Ableitung, gegen die jene sich richtet, und deckt seit Contract v51 nur
	 * noch den Einbettungsfall ab: ein VIDEO-Block mit {@code fileId} hat keine
	 * Embed-URL und ruft sie nie.
	 */
	public String embedUrlForVideo(String provider, String videoId) {
		return switch (provider) {
			case "youtube" -> "https://www.youtube.com/embed/" + videoId;
			case "vimeo" -> "https://player.vimeo.com/video/" + videoId;
			default -> throw new ValidationException(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED,
					"VIDEO: provider '" + provider + "' ist nicht erlaubt (zulaessig: youtube, vimeo)");
		};
	}

	/**
	 * Provider-Allowlist serverseitig: Provider erlaubt und embedUrl-Host passend
	 * zum Provider.
	 *
	 * <p>Die fehlende {@code embedUrl} ist ein Inhaltsfehler und ergibt
	 * {@code BLOCK_CONTENT_INVALID}; ein gesperrter Provider und ein Host, der
	 * nicht zu ihm gehoert, ergeben {@code EMBED_PROVIDER_NOT_ALLOWED}. §2.5
	 * nennt fuer „andere Hosts" ausdruecklich denselben Code wie fuer den
	 * Provider selbst: ein passender Providername mit fremdem Host waere sonst
	 * der Weg, die Allowlist zu umgehen.
	 */
	private void checkEmbed(int index, BlockType type, JsonNode attrs, Set<String> allowedProviders) {
		requireText(index, type, attrs, "embedUrl");
		String provider = attrs.path("provider").asText("");
		if (!allowedProviders.contains(provider)) {
			throw providerError(index, type + ": provider '" + provider
					+ "' ist nicht erlaubt (zulaessig: "
					+ String.join(", ", allowedProviders.stream().sorted().toList()) + ")");
		}
		String embedUrl = attrs.path("embedUrl").asText("");
		try {
			URI uri = URI.create(embedUrl);
			// Kleingeschrieben verglichen, wie beim link-Mark: RFC 3986 erklaert
			// Schema und Host fuer schreibweisenunabhaengig, java.net.URI
			// normalisiert aber keins von beiden. Ohne das Kleinschreiben wiese
			// der Server HTTPS://WWW.YOUTUBE.COM/... ab, obwohl §2.5 genau
			// diesen Host fuehrt.
			String scheme = uri.getScheme() == null
					? null : uri.getScheme().toLowerCase(Locale.ROOT);
			String host = uri.getHost() == null
					? null : uri.getHost().toLowerCase(Locale.ROOT);
			if (!"https".equals(scheme)
					|| host == null
					|| !ALLOWED_EMBED_HOSTS.get(provider).contains(host)) {
				throw providerError(index,
						type + ": embedUrl-Host passt nicht zum Provider '" + provider + "'");
			}
		} catch (IllegalArgumentException e) {
			throw error(index, type + ": embedUrl ist keine gueltige URL");
		}
	}

	// ------------------------------------------------------------------
	// Hilfsmittel
	// ------------------------------------------------------------------

	private void requireText(int index, BlockType type, JsonNode attrs, String field) {
		if (!isText(attrs, field)) {
			throw error(index, type + " braucht attrs." + field);
		}
	}

	private void requireFileId(int index, BlockType type, JsonNode attrs, String field) {
		requireFileId(index, type, field, attrs.path(field));
	}

	/**
	 * Jede {@code fileId} muss sich als UUID lesen lassen (§2.5).
	 *
	 * <p><strong>Ob unter der ID eine Datei liegt, prueft der Server hier
	 * nicht</strong> (KAN-72). Eine Existenzpruefung koppelte diese Klasse an das
	 * {@code StoredFileRepository}, machte jeden Autosave von der Reihenfolge
	 * Upload vor Speichern abhaengig und liesse ein vollstaendiges Dokument
	 * scheitern, weil eine einzelne Datei zwischenzeitlich geloescht wurde.
	 * Eine ins Leere zeigende fileId ergibt beim Abruf 404, und das ist die
	 * Stelle, an der sie hingehoert.
	 *
	 * @param label Feldname fuer die Meldung; bei Galerieeintraegen mit
	 *              Position, damit erkennbar ist, welches Bild gemeint ist
	 */
	private void requireFileId(int index, BlockType type, String label, JsonNode value) {
		if (!value.isTextual() || value.asText().isBlank()) {
			throw error(index, type + " braucht attrs." + label);
		}
		try {
			UUID.fromString(value.asText().trim());
		} catch (IllegalArgumentException e) {
			throw error(index, type + ": attrs." + label + " ist keine UUID");
		}
	}

	/** Pflichtattribut mit fester Werteliste, etwa {@code HEADING.level}. */
	private void requireIntFrom(int index, JsonNode attrs, String field, Set<Integer> allowed,
			String reason) {
		JsonNode value = attrs.path(field);
		if (!value.isIntegralNumber() || !allowed.contains(value.asInt())) {
			throw error(index, reason);
		}
	}

	/**
	 * Optionales Attribut mit fester Werteliste, etwa {@code IMAGE.width}.
	 * Fehlt es, ist das in Ordnung und der Server ergaenzt nichts (§3.4).
	 * Steht es da, gilt die Liste, und zwar als Zahl: der String {@code "100"}
	 * ist kein zulaessiger Wert, sonst liefen zwei Schreibweisen desselben
	 * Layouts nebeneinander.
	 */
	private void requireOptionalIntFrom(int index, JsonNode attrs, String field,
			Set<Integer> allowed, String reason) {
		JsonNode value = attrs.path(field);
		if (value.isMissingNode() || value.isNull()) {
			return;
		}
		if (!value.isIntegralNumber() || !allowed.contains(value.asInt())) {
			throw error(index, reason);
		}
	}

	/**
	 * Optionales Attribut mit fester Werteliste aus Zeichenketten, etwa
	 * {@code HEADING.textAlign}.
	 *
	 * <p>Wie {@link #requireOptionalIntFrom}: fehlt es, ergaenzt der Server
	 * nichts (§3.4). Ein ausdrueckliches {@code null} gilt als nicht gesetzt,
	 * denn Tiptap serialisiert bei {@code toJSON} alle im Node-Spec
	 * deklarierten Attribute, auch die ohne Wert. Ohne diese Zeile scheiterte
	 * jeder Autosave einer Ueberschrift ohne gewaehlte Ausrichtung.
	 */
	private void requireOptionalTextFrom(int index, JsonNode attrs, String field,
			Set<String> allowed, String reason) {
		JsonNode value = attrs.path(field);
		if (value.isMissingNode() || value.isNull()) {
			return;
		}
		if (!value.isTextual() || !allowed.contains(value.asText())) {
			throw error(index, reason);
		}
	}

	/**
	 * Ein mit §2.5 gestrichenes Attribut. Mit einem Wert belegt ergibt es 400,
	 * auch neben einem gueltigen Ersatz: nur so verschwindet das alte Feld
	 * wirklich aus dem Bestand, statt in jeden Export und jede Sicherung
	 * weiterzuwandern.
	 *
	 * <p><strong>Ein ausdrueckliches {@code null} gilt als nicht gesetzt</strong>
	 * (Klaerung zu KAN-72), deshalb {@code hasNonNull} und nicht {@code has}.
	 * Tiptap serialisiert bei {@code toJSON} regelmaessig alle im Node-Spec
	 * deklarierten Attribute, auch die ohne Wert; mit {@code has} scheiterte
	 * jeder Autosave eines Editors, dessen {@code audioBlock} das Feld nur noch
	 * strukturell mitfuehrt, obwohl fachlich nichts gesetzt ist. Die Streichung
	 * bleibt trotzdem wirksam: jede tatsaechlich belegte Fremd-URL und jede
	 * alte ID-Liste ergibt weiterhin 400.
	 */
	private void forbidAttribute(int index, JsonNode attrs, String field, String reason) {
		if (attrs.hasNonNull(field)) {
			throw error(index, "attrs." + field + " ist kein gueltiges Attribut mehr: " + reason);
		}
	}

	private boolean isText(JsonNode attrs, String field) {
		JsonNode value = attrs.path(field);
		return value.isTextual() && !value.asText().isBlank();
	}

	private ValidationException error(int index, String reason) {
		return new ValidationException(ErrorCodes.BLOCK_CONTENT_INVALID, "Block " + index + ": " + reason);
	}

	/** Verstoss gegen die Provider-Allowlist aus §2.5, eigener Code nach §6.2. */
	private ValidationException providerError(int index, String reason) {
		return new ValidationException(ErrorCodes.EMBED_PROVIDER_NOT_ALLOWED,
				"Block " + index + ": " + reason);
	}
}
