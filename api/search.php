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
 */

require_once __DIR__ . '/init.php';

// ─── Erlaubte Sortierfelder (nur echte Spalten aus items) ─────────────────────
const SORT_FIELDS = ['id', 'name', 'brand', 'model', 'serial_number', 'status', 'item_condition', 'created_at', 'updated_at'];

// ─── Input ────────────────────────────────────────────────────────────────────
$query     = mb_substr(strip_tags(trim(getStringParam('query'))), 0, 500, 'UTF-8');
$limit     = max(1, min(getIntParam('limit', 50), 200));
$sortField = in_array(getStringParam('sort', 'id'), SORT_FIELDS, true) ? getStringParam('sort', 'id') : 'id';
$sortOrder = strtoupper(getStringParam('order', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';

try {
    if ($query === '') {
        // ── Kein Suchbegriff: alle Items mit JOINs ────────────────────────────
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
        // ── Suche über mehrere Tabellen ───────────────────────────────────────
        //
        // Gesucht wird in:
        //   items:      id, name, brand, model, serial_number, notes, status
        //   categories: name (category_name)
        //   locations:  schrank (locker), regal, room
        //   specs:      value
        //   tags:       name
        //
        // Subquery-Ansatz für specs und tags, damit keine Duplikate entstehen.

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
        // 13 String-Parameter + 1 Int für LIMIT
        $stmt->bind_param(
            'sssssssssssss' . 'i',
            $query, $query, $query, $query, $query, $query, $query,
            $query, $query, $query, $query, $query, $query,
            $limit
        );
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
