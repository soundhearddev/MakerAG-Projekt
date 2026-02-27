<?php
/**
 * API Endpoint: fetch_all_items.php
 * Gibt alle Items zurück, mit optionalen Filtern und Pagination.
 *
 * GET ?limit=100           → max. Anzahl Ergebnisse (1–1000, Standard: 100)
 * GET ?offset=0            → Pagination-Offset
 * GET ?category_id=8       → Filter nach Kategorie-ID
 * GET ?category=Laptop     → Filter nach Kategorie-Name (JOIN auf categories)
 * GET ?status=verfügbar    → Filter nach Item-Status
 * GET ?random=true         → zufällige Reihenfolge
 */

require_once __DIR__ . '/init.php';

$limit      = max(1, min(getIntParam('limit', 100), 1000));
$offset     = max(0, getIntParam('offset', 0));
$categoryId = getIntParam('category_id', 0);
$category   = getStringParam('category');   // Kategorie-Name
$status     = getStringParam('status');
$random     = getStringParam('random') === 'true';

try {
    $conditions = [];
    $params     = [];
    $types      = '';

    // Filter: Kategorie per ID
    if ($categoryId > 0) {
        $conditions[] = "i.category_id = ?";
        $params[]     = $categoryId;
        $types       .= 'i';
    }

    // Filter: Kategorie per Name (JOIN auf categories)
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

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $order = $random ? 'ORDER BY RAND()' : 'ORDER BY i.id DESC';

    // Haupt-Query mit JOIN auf categories und locations
    $sql = "SELECT i.*, c.name AS category_name, p.name AS parent_category,
                   l.room, l.schrank AS locker, l.regal AS shelf, l.position
            FROM items i
            LEFT JOIN categories c ON c.id = i.category_id
            LEFT JOIN categories p ON p.id = c.parent_id
            LEFT JOIN locations l ON l.id = i.location_id
            {$where} {$order} LIMIT ? OFFSET ?";

    $params[] = $limit;
    $params[] = $offset;
    $types   .= 'ii';

    $stmt = $db->prepare($sql);
    if (!empty($params)) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $items = enrichItems($items);

    // Gesamt-Count für Pagination
    $countSql  = "SELECT COUNT(*) as total
                  FROM items i
                  LEFT JOIN categories c ON c.id = i.category_id
                  {$where}";
    // Params ohne limit/offset
    $countParams = array_slice($params, 0, -2);
    $countTypes  = rtrim($types, 'ii');

    $countStmt = $db->prepare($countSql);
    if (!empty($countParams)) $countStmt->bind_param($countTypes, ...$countParams);
    $countStmt->execute();
    $total = (int) $countStmt->get_result()->fetch_assoc()['total'];

    sendSuccess($items, [
        'count'    => count($items),
        'total'    => $total,
        'limit'    => $limit,
        'offset'   => $offset,
        'has_more' => ($offset + count($items)) < $total,
        'filters'  => [
            'category_id' => $categoryId ?: null,
            'category'    => $category ?: null,
            'status'      => $status ?: null,
            'random'      => $random,
        ],
    ]);
} catch (Exception $e) {
    error_log('fetch_all_items.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}
