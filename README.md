# MakerAG Inventarverwaltung

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/images/MakerAG-Black.png">
  <source media="(prefers-color-scheme: light)" srcset="/images/MakerAG-White.png">
  <img alt="Logo" src="/images/MakerAG-White.png">
</picture>

> Webbasiertes Inventarsystem für die Maker-AG – entwickelt als Praktikumsersatz im Rahmen der zweijährigen Assistentenausbildung für Informationsverarbeitung.

![PHP](https://img.shields.io/badge/PHP-8.x-777BB4?logo=php&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-10.x-003545?logo=mariadb&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![Raspberry Pi](https://img.shields.io/badge/Raspberry_Pi-4B-A22846?logo=raspberrypi&logoColor=white)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## Über das Projekt

Die Maker-AG verfügt über mehrere Schränke in den Räumen U24–U26 sowie einem Lagerraum – bisher ohne strukturierte Übersicht. Dieses System löst das Problem: Gegenstände werden erfasst, dokumentiert und bleiben dauerhaft auffindbar. Jeder Nutzer kann ohne Login den Status oder Standort eines Gegenstands aktualisieren.



## Features

- **Isometrische Raumansicht** – SVG-basierte Karte der Räume und Schränke, per JavaScript gerendert
- **Volltextsuche** – Filterbar nach Name, Kategorie, Schrank u. v. m., mit sortierbarer Ergebnisliste
- **Gegenstandsdokumentation** – Eigene Seite pro Eintrag mit allen Specs, Tags, Bildern und Dateien
- **Status & Standort** – Ohne Login direkt auf der Infoseite änderbar
- **Themes** – Wechselbare Farbpaletten
- **i18n** – Mehrsprachigkeit via JSON-Sprachdateien und `data-i18n`-Attributen
- **Feedback-System** – Name + Nachricht, mit serverseitigem Rate-Limiting




## Tech Stack

| Schicht | Technologie |
|---|---|
| Backend | PHP |
| Frontend | HTML · CSS · Vanilla JS |
| Datenbank | MariaDB |
| Server | Raspberry Pi 4B · 2 GB RAM |
| Webserver | Apache2 |



## Datenbankstruktur

```
items           – Haupttabelle aller Gegenstände
categories      – Selbstreferenziell, beliebig tief verschachtelbar
                  (z. B. Hardware → Computer → Laptop)
specs           – Key-Value-Pairs pro Item (flexibles Schema)
item_tags       – Pivot-Tabelle (Items ↔ Tags, n:m)
locations       – Standorte mit room_id-Referenz
rooms           – Räume
changelog       – Vollständige Änderungshistorie pro Item
feedback        – Name · Nachricht · Timestamp · IP (nur Rate-Limiting)
```





## Mitmachen

Pull Requests sind willkommen. Änderungen bitte gegen `develop` stellen – von dort wird in `main` gemergt.

| Branch | Zweck |
|---|---|
| `main` | Produktivbetrieb |
| `develop` | Neue Features, Tests |

---

