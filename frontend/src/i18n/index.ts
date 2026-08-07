import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./de.json";
import en from "./en.json";

/**
 * i18n-Grundgeruest (KAN-6, Abschnitt 6). Deutsch ist die Standardsprache;
 * beide Dateien werden ab hier gemeinsam gepflegt. Enum-Werte aus dem
 * API-Contract sind Schluesselbestandteil (project.status.PUBLISHED),
 * nie uebersetzter Text im Code.
 */
void i18n.use(initReactI18next).init({
	resources: {
		de: { translation: de },
		en: { translation: en },
	},
	lng: "de",
	fallbackLng: "de",
	interpolation: {
		/* React escapet selbst. */
		escapeValue: false,
	},
});

export default i18n;
