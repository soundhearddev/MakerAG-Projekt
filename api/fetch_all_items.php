<?php

/**
 * Gibt Items mit optionalen Filtern und Pagination zurück.
 *
 * GET ?limit=100         max. Anzahl (1–1000, Standard 100)
 * GET ?offset=0          Pagination-Offset
 * GET ?category_id=8     Filter nach Kategorie-ID
 * GET ?category=Laptop   Filter nach Kategorie-Name (Teiltreffer)
 * GET ?status=verfügbar  Filter nach Status
 * GET ?random=true       zufällige Reihenfolge
 */

require_once __DIR__ . '/init.php';

$limit = max(1, min(getIntParam('limit', 100), 1000));
$offset = max(0, getIntParam('offset', 0));
$categoryId = getIntParam('category_id');
$category = getStringParam('category');
$status = getStringParam('status');
$random = getStringParam('random') === 'true';

try {
    // WHERE wird dynamisch aus den gesetzten Filtern aufgebaut.
    $conditions = [];
    $params = [];
    $types = '';

    if ($categoryId > 0) {
        $conditions[] = 'i.category_id = ?';
        $params[] = $categoryId;
        $types .= 'i';
    }
    if ($category !== '') {
        $conditions[] = "c.name LIKE CONCAT('%', ?, '%')";
        $params[] = $category;
        $types .= 's';
    }
    if ($status !== '') {
        $conditions[] = 'i.status = ?';
        $params[] = $status;
        $types .= 's';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    // ORDER BY RAND() ist bei großen Tabellen langsam, bei dieser Größe unkritisch.
    $order = $random ? 'ORDER BY RAND()' : 'ORDER BY i.id DESC';

    $stmt = $db->prepare(
        "SELECT i.*, c.name AS category_name, p.name AS parent_category,
                l.room_id, l.schrank AS locker, l.fach AS shelf
         FROM items i
         LEFT JOIN categories c ON c.id = i.category_id
         LEFT JOIN categories p ON p.id = c.parent_id
         LEFT JOIN locations l ON l.id = i.location_id
         {$where} {$order} LIMIT ? OFFSET ?"
    );
    $stmt->bind_param($types . 'ii', ...[...$params, $limit, $offset]);
    $stmt->execute();
    $items = enrichItems($stmt->get_result()->fetch_all(MYSQLI_ASSOC));

    // Gesamtanzahl für die Pagination (gleiche Filter, ohne LIMIT/OFFSET).
    $countStmt = $db->prepare(
        "SELECT COUNT(*) FROM items i LEFT JOIN categories c ON c.id = i.category_id {$where}"
    );
    if ($params) {
        $countStmt->bind_param($types, ...$params);
    }
    $countStmt->execute();
    $total = (int) $countStmt->get_result()->fetch_row()[0];

    sendSuccess($items, [
        'count' => count($items),
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset,
        'has_more' => ($offset + count($items)) < $total,
        'filters' => [
            'category_id' => $categoryId ?: null,
            'category' => $category ?: null,
            'status' => $status ?: null,
            'random' => $random,
        ],
    ]);
} catch (Throwable $e) {
    sendException($e);
}
