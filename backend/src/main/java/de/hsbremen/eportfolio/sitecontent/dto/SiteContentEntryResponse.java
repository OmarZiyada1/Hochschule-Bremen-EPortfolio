package de.hsbremen.eportfolio.sitecontent.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Eine gepflegte Textstelle der Startseite in beiden Sprachen (§3.21, §6.1).
 *
 * <p><strong>Beide Sprachen in einer Antwort</strong>, kein Parameter
 * {@code ?language=}. Der Sprachumschalter des Frontends wechselt ohne
 * Neuladen; ein zweiter Request je Sprache waere ein sichtbares Nachladen
 * mitten im Text, und zwar genau an den Stellen, die die Administration
 * gepflegt hat.
 *
 * <p><strong>{@code null} heisst "nicht gepflegt", nicht "leer".</strong> Der
 * Client legt nur die gefuellten Werte ueber seine i18n-Vorgabe; wo hier
 * {@code null} steht, bleibt die mitgelieferte Fassung stehen. Deshalb steht
 * das Feld auch dann in der Antwort, wenn es leer ist: eine weggelassene
 * Eigenschaft waere vom Wert {@code null} nicht zu unterscheiden, aber der
 * Unterschied traegt hier die ganze Aussage.
 *
 * @param key     der i18n-Schluessel der Stelle, etwa {@code home.hero.label}
 * @param valueDe der deutsche Text oder {@code null}
 * @param valueEn der englische Text oder {@code null}
 */
public record SiteContentEntryResponse(

		@Schema(description = "i18n-Schluessel der Textstelle. Derselbe Schluessel, unter dem "
				+ "das Frontend seine mitgelieferte Fassung fuehrt.",
				example = "home.hero.subtitle")
		String key,

		@Schema(description = "Deutscher Text. null heisst: nicht gepflegt, es gilt die Vorgabe "
				+ "des Frontends.", nullable = true)
		String valueDe,

		@Schema(description = "Englischer Text. null heisst: nicht gepflegt, es gilt die Vorgabe "
				+ "des Frontends.", nullable = true)
		String valueEn) {
}
