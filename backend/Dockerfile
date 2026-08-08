# syntax=docker/dockerfile:1
#
# Drei Stufen fuer zwei Betriebsarten:
#   build   erzeugt das Fat-Jar (nur Zwischenstufe)
#   dev     Werkzeugkette fuer den Entwicklungsbetrieb, Quellcode kommt als Mount
#   runtime schlankes JRE-Image mit dem fertigen Jar
#
# Gebaut wird mit "mvn" aus dem Maven-Image und nicht mit "./mvnw":
# .mvn/wrapper/maven-wrapper.properties steht auf distributionType=only-script,
# der Wrapper laedt also bei jedem Build erst die Maven-Distribution nach.

# --------------------------------------------------------------------------
# Stufe build
# --------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# pom.xml zuerst und allein: die Schicht mit den Abhaengigkeiten bleibt im
# Cache, solange sich nur Quellcode aendert.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src

# Ohne Tests: die Tests laufen gegen eine echte Postgres (CLAUDE.md Regel 8),
# die es beim Image-Bau nicht gibt. Getestet wird auf dem Host mit ./mvnw test.
RUN mvn -B -DskipTests package

# --------------------------------------------------------------------------
# Stufe dev
# --------------------------------------------------------------------------
# Bewusst leer: pom.xml, src, target und ~/.m2 kommen zur Laufzeit aus
# docker-compose.override.yml. Wuerde hier etwas hineinkopiert, verdeckten die
# Mounts es ohnehin wieder.
FROM maven:3.9-eclipse-temurin-21 AS dev
WORKDIR /app
EXPOSE 8080
CMD ["mvn", "spring-boot:run"]

# --------------------------------------------------------------------------
# Stufe runtime
# --------------------------------------------------------------------------
FROM eclipse-temurin:21-jre AS runtime

# curl allein fuer den Healthcheck aus docker-compose.yml; das JRE-Image
# bringt kein HTTP-Werkzeug mit.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Muster statt festem Dateinamen, damit ein Versionssprung in der pom.xml den
# Build nicht bricht. Die *.jar.original des Repackagings passt nicht darauf.
COPY --from=build /app/target/*.jar app.jar

# Ablage des Local-Speicheradapters. app.storage.local-directory ist relativ
# zum Arbeitsverzeichnis, aus "var/storage" wird hier also /app/var/storage.
# Ohne das Volume aus docker-compose.yml waeren hochgeladene Dateien fluechtig.
RUN mkdir -p /app/var/storage

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
