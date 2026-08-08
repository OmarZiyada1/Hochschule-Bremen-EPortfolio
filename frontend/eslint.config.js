import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    /*
      Generierte Primitiven aus der shadcn-CLI. Sie exportieren neben der
      Komponente ihre cva-Varianten (button.tsx: Button und buttonVariants),
      was react-refresh/only-export-components anmerkt.

      Das ist ein Befund an der Konfiguration und nicht an der Komponente:
      Datei- und Exportnamen kommen aus der Registry und bleiben unveraendert,
      sonst faellt die Datei aus "shadcn add --diff" heraus. Die Regel wird
      deshalb genau hier abgeschaltet und nirgends sonst; eigener Code unter
      components/common oder features bleibt ihr unterworfen.
    */
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
