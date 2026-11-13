# MakerAG Inventarverwaltung

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/MakerAG-White.png">
  <source media="(prefers-color-scheme: light)" srcset="images/MakerAG-Black.png">
  <img alt="MakerAG Logo" src="images/MakerAG-White.png">
</picture>

Webbasierte Inventarverwaltung für die Maker-AG.

Die Maker-AG verfügt über mehrere Schränke in den Räumen U24–U26 sowie einen separaten Lagerraum. Das Projekt entstand im Rahmen meiner zweijährigen Assistentenausbildung für Informationsverarbeitung als Ersatz für das vorgesehene Praktikum.

Ziel war es, das vorhandene Inventar zentral zu erfassen und eine einfache Möglichkeit zu schaffen, Gegenstände wiederzufinden und deren Standort aktuell zu halten.

## Entwicklung

Das Projekt befindet sich derzeit in einem funktionsfähigen Zustand. Einige Bereiche sind noch nicht vollständig ausgearbeitet und sollen bei Bedarf weiterentwickelt werden.

Geplant sind unter anderem:

* [ ] Dokumentation vervollständigen
* [ ] Verbesserungen bei der Verwaltung von Gegenständen und deren Status
* [ ] Überarbeitung einzelner Bereiche der Benutzeroberfläche
* [ ] Tagsystem überarbeiten bzw. erweitern

## Entwicklung des Projekts

Für die Entwicklung werden die Änderungen zunächst im Branch `develop` vorgenommen. Nach Abschluss und Tests werden sie nach `main` übernommen.

| Branch    | Verwendung      |
| --------- | --------------- |
| `main`    | Aktueller Stand |
| `develop` | Entwicklung     |

## Konfiguration der API

Die Zugangsdaten liegen in `secure/config.php` (siehe `api/init.php`). Optionale Konstanten:

| Konstante                                | Wirkung                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `API_WRITE_TOKEN`                        | Schützt schreibende Endpunkte und den Feedback-Ticker. Der Client sendet das Token im Header `X-Api-Token`. Im Browser: `localStorage.setItem('api_token', '…')`. Ohne Konstante bleibt die API offen. |
| `RL_IP_CAPACITY`, `RL_IP_REFILL`, `RL_GL_CAPACITY`, `RL_GL_REFILL`, `RL_BLOCK_SECONDS` | Rate-Limit (benötigt APCu), Standardwerte siehe `api/RateLimiter.php`. |

## Lizenz

Apache License 2.0
