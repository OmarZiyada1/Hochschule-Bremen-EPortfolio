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
})

export default i18n
