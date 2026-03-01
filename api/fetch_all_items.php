<?php
/**
 * API Endpoint: fetch_all_items.php
 * Gibt alle Items zurück, mit optionalen Filtern und Pagination.
 *
 * GET ?limit=100           → max. Anzahl Ergebnisse (1–1000, Standard: 100)
 * GET ?offset=0            → Pagination-Offset (wie viele Items überspringen)
 * GET ?category_id=8       → Filter nach Kategorie-ID
 * GET ?category=Laptop     → Filter nach Kategorie-Name (JOIN auf categories)
 * GET ?status=verfügbar    → Filter nach Item-Status
 * GET ?random=true         → zufällige Reihenfolge
 */

require_once __DIR__ . '/init.php';

// ─── Parameter einlesen ───────────────────────────────────────────────────────
// max(1, min(wert, 1000)) = clamping: Wert darf nicht unter 1 oder über 1000 sein
$limit      = max(1, min(getIntParam('limit', 100), 1000));
$offset     = max(0, getIntParam('offset', 0));
$categoryId = getIntParam('category_id', 0);
$category   = getStringParam('category');   // Kategorie-Name als Text
$status     = getStringParam('status');
// getStringParam gibt '' oder 'true' zurück → === 'true' macht daraus einen echten bool
$random     = getStringParam('random') === 'true';

try {
    // ─── Dynamisches WHERE aufbauen ───────────────────────────────────────────
    // Statt fixen WHERE-Klausel werden Bedingungen und Parameter dynamisch gesammelt.
    // Das ermöglicht beliebige Kombinationen von Filtern ohne Code-Duplikation.
    $conditions = []; // SQL-Bedingungen als Strings: ["i.category_id = ?", "i.status = ?"]
    $params     = []; // Werte die an die ?-Platzhalter gebunden werden
    $types      = ''; // Typ-String für bind_param: 'i'=int, 's'=string, 'ii'=zwei ints usw.

    // Filter: Kategorie per ID
    if ($categoryId > 0) {
        $conditions[] = "i.category_id = ?";
        $params[]     = $categoryId;
        $types       .= 'i'; // .= hängt den Buchstaben an den Typ-String an
    }

    // Filter: Kategorie per Name
    // CONCAT('%', ?, '%') = LIKE-Suche mit Wildcard auf beiden Seiten
    // Das ist der sichere Weg um '%Dell%' mit Prepared Statements zu machen
    // (direkt '%' . $val . '%' in den SQL-String wäre eine SQL-Injection-Lücke)
    if ($category !== '') {
        $conditions[] = "c.name LIKE CONCAT('%', ?, '%')";
        $params[]     = $category;
        $types       .= 's';
    }

    // Filter: Status
    if ($status !== '') {
        $conditions[] = "i.status = ?";
        $params[]     = $status;
        $types       .= 's';
    }

    // Bedingungen zusammenbauen: ["a = ?", "b = ?"] → "WHERE a = ? AND b = ?"
    // $conditions ? ... : '' = wenn Array nicht leer, WHERE schreiben, sonst leerer String
    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    // ORDER BY RAND() = zufällige Reihenfolge (langsam bei großen Tabellen!)
    $order = $random ? 'ORDER BY RAND()' : 'ORDER BY i.id DESC';

    // ─── Haupt-Query ──────────────────────────────────────────────────────────
    // i.* = alle Spalten aus items
    // c.name AS category_name = Kategorie-Name mit Alias umbenennen
    // p.name AS parent_category = Oberkategorie (p = parent, zweiter JOIN auf categories)
    // l.schrank AS locker = DB-Spalte heißt 'schrank', im JSON heißt sie 'locker'
    //
    // LEFT JOIN = auch Items ohne Kategorie/Location kommen in die Ergebnisse
    // (INNER JOIN würde Items ohne Location komplett rausfiltern)
    $sql = "SELECT i.*, c.name AS category_name, p.name AS parent_category,
                   l.room, l.schrank AS locker, l.regal AS shelf, l.position
            FROM items i
            LEFT JOIN categories c ON c.id = i.category_id
            LEFT JOIN categories p ON p.id = c.parent_id
            LEFT JOIN locations l ON l.id = i.location_id
            {$where} {$order} LIMIT ? OFFSET ?";

    // LIMIT und OFFSET am Ende anhängen (kommen immer, deshalb direkt hier)
    $params[] = $limit;
    $params[] = $offset;
    $types   .= 'ii';

    $stmt = $db->prepare($sql);
    // ... (spread operator) = Array als einzelne Argumente übergeben
    // also bind_param('sii', $category, $limit, $offset) ohne zu wissen wieviel Parameter es sind
    if (!empty($params)) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    // fetch_all(MYSQLI_ASSOC) = alle Zeilen auf einmal holen als assoziatives Array
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    // Jedes Item mit Kategorie, Location, Specs, Tags, Thumbnail usw. anreichern
    $items = enrichItems($items);

    // ─── Count-Query für Pagination ───────────────────────────────────────────
    // Die Haupt-Query gibt max. $limit Ergebnisse zurück.
    // Für Pagination braucht das Frontend aber die GESAMT-Anzahl ("100 von 347 Items")
    $countSql  = "SELECT COUNT(*) as total
                  FROM items i
                  LEFT JOIN categories c ON c.id = i.category_id
                  {$where}";

    // Nur die Filter-Parameter nehmen, NICHT limit und offset
    // array_slice($params, 0, -2) = Array ohne die letzten 2 Elemente
    $countParams = array_slice($params, 0, -2);
    // rtrim entfernt die 'ii' am Ende des Typ-Strings (für limit und offset)
    $countTypes  = rtrim($types, 'ii');

    $countStmt = $db->prepare($countSql);
    if (!empty($countParams)) $countStmt->bind_param($countTypes, ...$countParams);
    $countStmt->execute();
    $total = (int) $countStmt->get_result()->fetch_assoc()['total'];

    // ─── Antwort ──────────────────────────────────────────────────────────────
    sendSuccess($items, [
        'count'    => count($items),    // Anzahl in dieser Antwort
        'total'    => $total,           // Gesamt-Anzahl (für Pagination)
        'limit'    => $limit,
        'offset'   => $offset,
        // has_more = true wenn es noch mehr Items gibt die nicht geladen wurden
        'has_more' => ($offset + count($items)) < $total,
        'filters'  => [
            'category_id' => $categoryId ?: null, // ?: = 0 wird zu null (sauberer im JSON)
            'category'    => $category ?: null,
            'status'      => $status ?: null,
            'random'      => $random,
        ],
    ]);
} catch (Exception $e) {
    error_log('fetch_all_items.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}