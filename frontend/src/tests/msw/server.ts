import { setupServer } from "msw/node"

/**
 * MSW-Server fuer den Testlauf, gestartet in tests/setup.ts (KAN-30,
 * Umfang 7). Es gibt bewusst keine Standard-Handler: jeder Test meldet
 * seine Antworten selbst ueber server.use(...) an, und ein Request ohne
 * Handler ist ein Fehler (onUnhandledRequest "error" in setup.ts), kein
 * stiller Durchlauf ins Netz.
 */
export const server = setupServer()
