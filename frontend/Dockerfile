# syntax=docker/dockerfile:1
#
# Vier Stufen fuer zwei Betriebsarten:
#   base    Node plus Corepack
#   dev     Vite-Dev-Server, Quellcode und node_modules kommen als Mount
#   build   erzeugt dist/ (nur Zwischenstufe)
#   runtime nginx liefert dist/ aus und leitet die API ans Backend weiter
#
# Basis ist bewusst bookworm-slim und nicht Alpine: @tailwindcss/oxide
# uebersetzt beim Installieren eine native Bibliothek gegen glibc
# (siehe allowBuilds in pnpm-workspace.yaml).

# --------------------------------------------------------------------------
# Stufe base
# --------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Nur im Image, nicht projektweit: pnpm weist sonst jedes Paket ab, das
# juenger als 24 Stunden ist, und der Bau schlaegt nach jeder Aktualisierung
# einen Tag lang fehl. Der Schutz zielt auf das Aufloesen neuer Versionen;
# das findet hier nicht statt, das Lockfile ist eingefroren und bringt seine
# Pruefsummen mit. Beim "pnpm add" auf dem Rechner der Entwickler greift die
# Regel unveraendert.
#
# Als Umgebungsvariable und nicht als Schalter am Aufruf, weil jeder
# pnpm-Befehl vorab noch einmal selbst "pnpm install" startet und ein
# Schalter dorthin nicht durchgereicht wird.
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0

# Corepack liest die pnpm-Version aus dem Feld packageManager der package.json.
RUN corepack enable
WORKDIR /app

# --------------------------------------------------------------------------
# Stufe dev
# --------------------------------------------------------------------------
# Bewusst leer: Quellcode und node_modules kommen zur Laufzeit aus
# docker-compose.override.yml. node_modules darf nie vom Host stammen, weil
# die native Bibliothek von Tailwind dort fuer Windows uebersetzt ist.
FROM base AS dev
EXPOSE 5173
CMD ["pnpm", "dev"]

# --------------------------------------------------------------------------
# Stufe build
# --------------------------------------------------------------------------
FROM base AS build

# Erst die Manifeste: die Installationsschicht bleibt im Cache, solange sich
# nur Quellcode aendert.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Die Angaben des Impressums (KAN-100).
#
# Sie sind sichtbarer Oberflaechentext und stehen trotzdem nicht in den
# Sprachdateien: das Repository liegt oeffentlich auf GitHub, und eine
# ladungsfaehige Privatanschrift bliebe dort auch nach dem Herausnehmen in
# der Historie stehen. Sie kommen deshalb aus der .env, wie jeder andere
# Betriebswert.
#
# WARUM ARG UND NICHT ENV IM LAUFENDEN CONTAINER. Vite backt die Werte
# beim Buendeln in die JS-Dateien ein; zur Laufzeit liest niemand mehr
# eine Umgebungsvariable. Die Stufe runtime ist ein nginx, der fertige
# Dateien ausliefert. Der einzige Zeitpunkt, an dem der Wert ankommen
# kann, ist also dieser hier.
#
# Die leeren Standardwerte halten den Bau ohne gesetzte .env am Laufen:
# ohne sie bricht "docker compose build" mit einer Warnung ab, sobald
# jemand das Bild ohne diese Werte baut. Fehlt der Wert, sagt das
# Impressum das sichtbar, statt eine Anschrift zu erfinden.
#
# Jeder ARG braucht sein ENV daneben. ARG allein ist eine Variable des
# Dockerfiles und steht dem Prozess in RUN nicht in der Umgebung; Vite
# nimmt VITE_-Werte aber genau von dort entgegen, naemlich aus process.env.
ARG VITE_IMPRINT_OPERATOR=""
ARG VITE_IMPRINT_STREET=""
ARG VITE_IMPRINT_CITY=""
ARG VITE_IMPRINT_EMAIL=""
ENV VITE_IMPRINT_OPERATOR=$VITE_IMPRINT_OPERATOR
ENV VITE_IMPRINT_STREET=$VITE_IMPRINT_STREET
ENV VITE_IMPRINT_CITY=$VITE_IMPRINT_CITY
ENV VITE_IMPRINT_EMAIL=$VITE_IMPRINT_EMAIL

RUN pnpm build

# --------------------------------------------------------------------------
# Stufe runtime
# --------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
