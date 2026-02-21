<?php
/**
 * API Endpoint: search.php
 * Durchsucht alle relevanten Spalten der items-Tabelle.
 *
 * GET ?query=Dell       → Suche nach "Dell"
 * GET ?query=           → Alle Items (neueste zuerst)
 * GET ?sort=name        → Sortierung nach Feld (id, name, category, …)
 * GET ?order=ASC        → Sortierreihenfolge (ASC | DESC, Standard: DESC)
 * GET ?limit=50         → Max. Ergebnisse (1–200, Standard: 50)
 */

require_once __DIR__ . './init.php';



// ─── Erlaubte Sortierfelder ────────────────────────────────────────────────────
const SORT_FIELDS = ['id', 'name', 'category', 'subcategory', 'brand', 'model', 'quantity', 'locker'];
const SEARCH_FIELDS = ['id', 'name', 'category', 'subcategory', 'brand', 'model', 'serial', 'quantity', 'locker', 'notes'];

// ─── Input ────────────────────────────────────────────────────────────────────
$query     = mb_substr(strip_tags(trim(getStringParam('query'))), 0, 500, 'UTF-8');
$limit     = max(1, min(getIntParam('limit', 50), 200));
$sortField = in_array(getStringParam('sort', 'id'), SORT_FIELDS, true) ? getStringParam('sort', 'id') : 'id';
$sortOrder = strtoupper(getStringParam('order', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';

try {
    if ($query === '') {
        // ── Kein Suchbegriff: alle Items holen ────────────────────────────────
        $sql  = "SELECT * FROM items ORDER BY `{$sortField}` {$sortOrder} LIMIT ?";
        $stmt = $db->prepare($sql);
        $stmt->bind_param('i', $limit);
    } else {
        // ── Suche: nur existierende Spalten berücksichtigen ────────────────────
        $existingColumns = [];
        $colResult = $db->query("SHOW COLUMNS FROM items");
        while ($col = $colResult->fetch_assoc()) {
            $existingColumns[] = $col['Field'];
        }

        $clauses = [];
        $params  = [];
        $types   = '';

        foreach (SEARCH_FIELDS as $field) {
            if (!in_array($field, $existingColumns, true)) continue;

            // Integer-Felder müssen erst in CHAR gecastet werden
            $clauses[] = in_array($field, ['id', 'quantity'])
                ? "CAST(`{$field}` AS CHAR) LIKE CONCAT('%', ?, '%')"
                : "`{$field}` LIKE CONCAT('%', ?, '%')";

            $params[] = $query;
            $types   .= 's';
        }

        if (empty($clauses)) {
            sendError('Keine durchsuchbaren Spalten gefunden', 500);
        }

        $sql  = "SELECT * FROM items WHERE " . implode(' OR ', $clauses)
              . " ORDER BY `{$sortField}` {$sortOrder} LIMIT ?";
        $stmt = $db->prepare($sql);

        $params[] = $limit;
        $types   .= 'i';
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $items = enrichItems($items);

    sendSuccess($items, [
        'count' => count($items),
        'query' => $query,
        'sort'  => ['field' => $sortField, 'order' => $sortOrder],
        'limit' => $limit,
    ]);
} catch (Exception $e) {
    error_log('search.php: ' . $e->getMessage());
    sendError('Suchfehler', 500);
}