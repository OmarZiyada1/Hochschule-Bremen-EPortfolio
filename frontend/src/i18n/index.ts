import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import de from "./de.json"
import en from "./en.json"

/**
 * i18n-Grundgeruest (KAN-6, Abschnitt 7). Deutsch ist Standardsprache und
 * zugleich Rueckfallebene; Englisch wird ab hier mitgepflegt, damit ein
 * Schluessel nicht erst im englischen Betrieb als roher Name auffaellt.
 *
 * Enum-Werte aus dem API-Contract sind Schluesselbestandteil und kein Text:
 * project.status.PUBLISHED, user.role.EDITOR. Der Wert laeuft unveraendert
 * durch den Code, uebersetzt wird nur die Anzeige.
 */
export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: "de",
  fallbackLng: "de",
  interpolation: {
    // React maskiert selbst; eine zweite Maskierung wuerde Umlaute in
    // Platzhaltern zerlegen.
    escapeValue: false,
  },
  react: {
    /*
     * Ohne diese Zeile bliebe eine nachtraeglich geladene Fassung
     * unsichtbar. Die Startseite legt die von der Administration
     * gepflegten Texte per addResourceBundle ueber die mitgelieferten
     * (features/home/hooks/useSiteContentOverrides.ts, Contract §2.16);
     * das loest im Ressourcenspeicher das Ereignis "added" aus.
     *
     * react-i18next hoert darauf nur, wenn bindI18nStore es nennt: die
     * Vorgabe der Bibliothek ist der leere String, und
     * `if (bindI18nStore) i18n.store.on(...)` meldet dann gar nichts an
     * (nachgesehen in react-i18next 17.0.11, defaults und useTranslation).
     * Die Werte staenden also im Speicher, und auf dem Bildschirm bliebe
     * die Vorgabe stehen, bis irgendetwas anderes ein Rendern ausloest.
     */
    bindI18nStore: "added",
  },
})

export default i18n
