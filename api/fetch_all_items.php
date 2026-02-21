<?php
/**
 * API Endpoint: fetch_all_items.php
 * Gibt alle Items zurück, mit optionalen Filtern und Pagination.
 *
 * GET ?limit=100       → max. Anzahl Ergebnisse (1–1000, Standard: 100)
 * GET ?offset=0        → Pagination-Offset
 * GET ?category=Laptop → Filter nach Kategorie
 * GET ?random=true     → zufällige Reihenfolge
 * GET ?latest=true     → neueste zuerst (Standard)
 */

require_once __DIR__ . './init.php';

$limit    = max(1, min(getIntParam('limit', 100), 1000));
$offset   = max(0, getIntParam('offset', 0));
$category = getStringParam('category');
$random   = getStringParam('random') === 'true';

try {
    // ── Haupt-Query ────────────────────────────────────────────────────────────
    $conditions = [];
    $params     = [];
    $types      = '';

    if ($category !== '') {
        $conditions[] = "category = ?";
        $params[]     = $category;
        $types       .= 's';
    }

    $where  = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $order  = $random ? 'ORDER BY RAND()' : 'ORDER BY id DESC';

    $sql  = "SELECT * FROM items {$where} {$order} LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types   .= 'ii';

    $stmt = $db->prepare($sql);
    if (!empty($params)) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $items = enrichItems($items);

    // ── Gesamt-Count für Pagination ────────────────────────────────────────────
    $countSql  = "SELECT COUNT(*) as total FROM items {$where}";
    $countStmt = $db->prepare($countSql);
    if ($category !== '') $countStmt->bind_param('s', $category);
    $countStmt->execute();
    $total = (int) $countStmt->get_result()->fetch_assoc()['total'];

    sendSuccess($items, [
        'count'    => count($items),
        'total'    => $total,
        'limit'    => $limit,
        'offset'   => $offset,
        'has_more' => ($offset + count($items)) < $total,
        'filters'  => [
            'category' => $category ?: null,
            'random'   => $random,
        ],
    ]);
} catch (Exception $e) {
    error_log('fetch_all_items.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}