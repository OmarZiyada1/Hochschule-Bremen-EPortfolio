package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.common.enums.BlockType;

/**
 * Zahl der Inhaltsbloecke je Blocktyp, Ergebniszeile von
 * {@link BlockRepository#countPerType()}.
 *
 * <p>Grundlage der Kennzahl {@code blocksByType} des Admin-Dashboards. Sie ist
 * ueberhaupt nur moeglich, weil {@code Block.type} eine eigene Spalte ist und
 * nicht bloss im {@code jsonb} des Inhalts steckt (§2.5); ueber
 * jsonb-Ausdruecke waere dieselbe Auswertung weder indexierbar noch lesbar.
 *
 * @param type  Blocktyp, zu dem gezaehlt wurde
 * @param count Zahl der Bloecke dieses Typs ueber alle Projekte. Typen ohne
 *              Block kommen in der Ergebnisliste gar nicht vor; der Dienst
 *              ergaenzt sie mit 0
 */
public record BlockTypeCount(BlockType type, long count) {
}
