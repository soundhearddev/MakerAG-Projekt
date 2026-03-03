<?php
/**
 * API Endpoint: search.php
 * Durchsucht Items über mehrere Tabellen (items, categories, locations, specs, tags).
 *
 * GET ?query=Dell       → Suche nach "Dell"
 * GET ?query=           → Alle Items (neueste zuerst)
 * GET ?sort=name        → Sortierung nach Feld
 * GET ?order=ASC        → Sortierreihenfolge (ASC | DESC, Standard: DESC)
 * GET ?limit=50         → Max. Ergebnisse (1–200, Standard: 50)
 * GET ?searchFor=Marke  → Nur in bestimmtem Feld suchen
 */

require_once __DIR__ . '/init.php';

// ─── Erlaubte Sortierfelder ───────────────────────────────────────────────────
// Whitelist! Der Benutzer übergibt ?sort=name → wir prüfen ob 'name' erlaubt ist.
// Ohne Whitelist könnte man beliebige SQL in den ORDER BY schreiben (SQL-Injection).
// Prepared Statements funktionieren für ORDER BY nicht, deshalb Whitelist-Ansatz.
const SORT_FIELDS = ['id', 'name', 'brand', 'model', 'serial_number', 'status', 'item_condition', 'created_at', 'updated_at'];

// ─── Input ────────────────────────────────────────────────────────────────────
// mb_substr = Multibyte-sicher kürzen (wichtig für Umlaute/Sonderzeichen)
// strip_tags = HTML-Tags entfernen (<script> usw.)
// max 500 Zeichen als Sicherheitslimit
$query     = mb_substr(strip_tags(trim(getStringParam('query'))), 0, 500, 'UTF-8');
$limit     = max(1, min(getIntParam('limit', 50), 200));
// in_array prüft ob der übergebene Sort-Wert in der Whitelist ist
// Wenn nicht → 'id' als sicheren Fallback nehmen
$sortField = in_array(getStringParam('sort', 'id'), SORT_FIELDS, true) ? getStringParam('sort', 'id') : 'id';
// strtoupper macht 'asc' → 'ASC', dann === 'ASC' prüfen → sonst DESC
$sortOrder = strtoupper(getStringParam('order', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';


// ─── searchFor: Mapping Frontend-Wert → SQL-Ausdruck ─────────────────────────
// Das Frontend schickt einen deutschen Label wie "Marke",
// wir übersetzen das in den echten SQL-Spaltennamen.
// Auch hier: kein direktes Einfügen von Benutzereingaben in SQL!
// CAST(i.id AS CHAR) = Zahl 42 zu String "42" machen damit LIKE darauf funktioniert
$searchForMap = [
    'ID'           => 'CAST(i.id AS CHAR)',
    'Name'         => 'i.name',
    'Kategorie'    => 'c.name',
    'Marke'        => 'i.brand',
    'Modell'       => 'i.model',
    'Seriennummer' => 'i.serial_number',
    'Locker'       => 'l.schrank',
];
$searchForRaw = getStringParam('searchFor', '');
// isset() prüft ob der Key existiert. Wenn nicht → null (Vollsuche)
$searchForCol = isset($searchForMap[$searchForRaw]) ? $searchForMap[$searchForRaw] : null;


try {
    if ($query === '') {
        // ── Kein Suchbegriff: alle Items ──────────────────────────────────────
        // `{$sortField}` in Backticks weil Feldnamen wie 'status' reservierte MySQL-Wörter
        // sein können. Backticks sagen MySQL "das ist ein Spaltenname, kein Schlüsselwort".
        $sql = "SELECT i.*, c.name AS category_name, p.name AS parent_category,
                       l.room, l.schrank AS locker, l.regal AS shelf, l.position
                FROM items i
                LEFT JOIN categories c ON c.id = i.category_id
                LEFT JOIN categories p ON p.id = c.parent_id
                LEFT JOIN locations l ON l.id = i.location_id
                ORDER BY i.`{$sortField}` {$sortOrder}
                LIMIT ?";

        $stmt = $db->prepare($sql);
        $stmt->bind_param('i', $limit);
    } else {
        // ── Mit Suchbegriff ───────────────────────────────────────────────────

        if ($searchForCol !== null) {
            // ── Nur ein bestimmtes Feld durchsuchen ────────────────────────────
            // DISTINCT = keine doppelten Zeilen (kann durch JOINs entstehen)
            // Kein specs/tags JOIN nötig weil wir nicht dort suchen
            $sql = "SELECT DISTINCT i.*, c.name AS category_name, p.name AS parent_category,
                           l.room, l.schrank AS locker, l.regal AS shelf, l.position
                    FROM items i
                    LEFT JOIN categories c ON c.id = i.category_id
                    LEFT JOIN categories p ON p.id = c.parent_id
                    LEFT JOIN locations l ON l.id = i.location_id
                    WHERE {$searchForCol} LIKE CONCAT('%', ?, '%')
                    ORDER BY i.`{$sortField}` {$sortOrder}
                    LIMIT ?";

            // 's' für den Suchstring, 'i' für das Limit = 'si'
            $stmt = $db->prepare($sql);
            $stmt->bind_param('si', $query, $limit);
        } else {
            // ── Vollsuche über ALLE Felder ─────────────────────────────────────
            //
            // LEFT JOIN auf specs und tags damit wir auch dort suchen können.
            // DISTINCT verhindert Duplikate: ein Item mit 3 Tags würde sonst 3x auftauchen.
            //
            // Jedes LIKE bekommt den gleichen Suchbegriff ($query) als eigenen ?-Parameter.
            // Man kann denselben Wert nicht "wiederverwenden" in Prepared Statements –
            // deshalb 13x $query in bind_param.
            $sql = "SELECT DISTINCT i.*, c.name AS category_name, p.name AS parent_category,
                           l.room, l.schrank AS locker, l.regal AS shelf, l.position
                    FROM items i
                    LEFT JOIN categories c ON c.id = i.category_id
                    LEFT JOIN categories p ON p.id = c.parent_id
                    LEFT JOIN locations l ON l.id = i.location_id
                    LEFT JOIN specs s ON s.item_id = i.id
                    LEFT JOIN item_tags it ON it.item_id = i.id
                    LEFT JOIN tags t ON t.id = it.tag_id
                    WHERE
                        CAST(i.id AS CHAR)  LIKE CONCAT('%', ?, '%') OR
                        i.name              LIKE CONCAT('%', ?, '%') OR
                        i.brand             LIKE CONCAT('%', ?, '%') OR
                        i.model             LIKE CONCAT('%', ?, '%') OR
                        i.serial_number     LIKE CONCAT('%', ?, '%') OR
                        i.notes             LIKE CONCAT('%', ?, '%') OR
                        i.status            LIKE CONCAT('%', ?, '%') OR
                        c.name              LIKE CONCAT('%', ?, '%') OR
                        l.schrank           LIKE CONCAT('%', ?, '%') OR
                        l.regal             LIKE CONCAT('%', ?, '%') OR
                        l.room              LIKE CONCAT('%', ?, '%') OR
                        s.value             LIKE CONCAT('%', ?, '%') OR
                        t.name              LIKE CONCAT('%', ?, '%')
                    ORDER BY i.`{$sortField}` {$sortOrder}
                    LIMIT ?";

            $stmt = $db->prepare($sql);
            // 13 mal 's' für die 13 LIKE-Vergleiche, dann 'i' für LIMIT
            // $query muss 13x übergeben werden weil jedes ? ein eigener Parameter ist
            $stmt->bind_param(
                'sssssssssssss' . 'i',
                $query, $query, $query, $query, $query, $query, $query,
                $query, $query, $query, $query, $query, $query,
                $limit
            );
        }
    }

    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $items = enrichItems($items);

    sendSuccess($items, [
        'count'     => count($items),
        'query'     => $query,
        'searchFor' => $searchForRaw ?: 'all', // 'all' wenn kein spezifisches Feld
        'sort'      => ['field' => $sortField, 'order' => $sortOrder],
        'limit'     => $limit,
    ]);
} catch (Exception $e) {
    error_log('search.php: ' . $e->getMessage());
    sendError('Suchfehler', 500);
}