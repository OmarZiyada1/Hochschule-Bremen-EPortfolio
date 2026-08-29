package de.hsbremen.eportfolio.sitecontent;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/**
 * Ein gepflegter Text der oeffentlichen Startseite, in genau einer Sprache
 * (§3.21).
 *
 * <p><strong>Eine Zeile je Schluessel und Sprache</strong>, nicht ein
 * Spaltenpaar {@code value_de}/{@code value_en} und kein {@code jsonb}. Zwei
 * Gruende. Erstens braucht eine dritte Sprache damit keine neue Spalte und
 * keinen Umbau des Bestands, sondern nur einen weiteren zulaessigen Wert im
 * Check-Constraint {@code ck_site_content_locale}. Zweitens faellt der Rueckfall
 * auf die i18n-Vorgabe des Frontends damit je Schluessel <em>und</em> je
 * Sprache: wer nur den deutschen Text pflegt, bekommt in der englischen Ansicht
 * die englische Vorgabe und nicht deutschen Text. Mit einem Spaltenpaar waere
 * die naheliegende Notloesung gewesen, die gepflegte Sprache auch dort zu
 * zeigen, wo sie nicht hingehoert, und das verletzt WCAG 2.2 SC 3.1.2 (§2.5).
 *
 * <p><strong>Die Tabelle startet leer und wird nicht befuellt.</strong> Es gibt
 * weder Seed-Daten noch eine Uebernahme aus den i18n-Dateien. Ein fehlender
 * Eintrag ist kein Mangel, sondern die Aussage "hier gilt die Vorgabe des
 * Frontends"; ein Backfill haette diese Aussage beim ersten Start unwiderruflich
 * in "die Administration hat genau diesen Text gewaehlt" verwandelt, und der
 * Weg zurueck zur mitgelieferten Fassung waere nur noch das Leeren des Feldes
 * gewesen.
 *
 * <p>Wie die Stammdaten ohne Zeitstempel: {@link BaseEntity} bringt nur die
 * {@code id}. Auch ohne {@code version}, also ohne Optimistic Locking aus §6.4:
 * gepflegt wird ausschliesslich von ADMIN ueber einen einzigen Endpoint, der
 * die uebergebenen Schluessel vollstaendig ersetzt, und es gibt keinen zweiten
 * Schreibweg, gegen den sich eine Fassung verlieren koennte.
 */
@Entity
public class SiteContent extends BaseEntity {

	/** Sprachkennung der deutschen Fassung, wie sie in der Spalte steht. */
	public static final String LOCALE_DE = "de";

	/** Sprachkennung der englischen Fassung, wie sie in der Spalte steht. */
	public static final String LOCALE_EN = "en";

	@Enumerated(EnumType.STRING)
	@Column(name = "content_key", nullable = false, length = 64)
	private SiteContentKey contentKey;

	/**
	 * Die Sprache dieser Zeile, {@link #LOCALE_DE} oder {@link #LOCALE_EN}.
	 *
	 * <p><strong>Bewusst kein Java-Enum</strong>, anders als bei den uebrigen
	 * als Zeichenkette gespeicherten Feldern. Ein Enum schriebe seine
	 * Konstantennamen in die Spalte, also {@code DE} und {@code EN}, und die
	 * Sprachkennung ist nach BCP 47 kleingeschrieben. Sie geht genau so in die
	 * i18n-Schicht des Frontends und in das {@code lang}-Attribut der Seite;
	 * eine Uebersetzung zwischen Speicherform und Aussenform waere eine zweite
	 * Zuordnung neben der aus {@link SiteContentKey}, ohne dass sie etwas
	 * gewaenne.
	 */
	@Column(nullable = false, length = 8)
	private String locale;

	@Column(columnDefinition = "text", nullable = false)
	private String value;

	protected SiteContent() {
		// Von JPA benoetigt.
	}

	/**
	 * Eine neue gepflegte Textstelle.
	 *
	 * @param contentKey die Stelle auf der Startseite
	 * @param locale     {@link #LOCALE_DE} oder {@link #LOCALE_EN}
	 * @param value      der Text; leer wird nie gespeichert, sondern loescht die
	 *                   Zeile (siehe {@code SiteContentService})
	 */
	public SiteContent(SiteContentKey contentKey, String locale, String value) {
		this.contentKey = contentKey;
		this.locale = locale;
		this.value = value;
	}

	public SiteContentKey getContentKey() {
		return contentKey;
	}

	public String getLocale() {
		return locale;
	}

	public String getValue() {
		return value;
	}

	public void setValue(String value) {
		this.value = value;
	}
}
