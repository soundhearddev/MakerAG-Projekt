<?php

/**
 * Durchsucht Items über items, categories, locations, specs und tags.
 *
 * GET ?query=Dell        Suchbegriff (leer: alle Items)
 * GET ?searchFor=Marke   nur in diesem Feld suchen
 * GET ?category_id=8     auf Kategorie (inkl. Unterkategorien) einschränken
 * GET ?sort=name         Sortierfeld (Whitelist)
 * GET ?order=ASC         ASC | DESC (Standard DESC)
 * GET ?limit=50          1–200 (Standard 50)
 */

require_once __DIR__ . '/init.php';

// Spaltennamen lassen sich nicht binden, daher Whitelist.
const SORT_FIELDS = ['id', 'name', 'brand', 'model', 'status', 'item_condition', 'created_at', 'updated_at'];

// Frontend-Label → SQL-Ausdruck.
const SEARCH_FIELDS = [
    'ID' => 'CAST(i.id AS CHAR)',
    'Name' => 'i.name',
    'Kategorie' => 'c.name',
    'Marke' => 'i.brand',
    'Modell' => 'i.model',
    'Locker' => 'l.schrank',
    'Raum' => 'r.name',
];

// Spalten der Vollsuche.
const FULLTEXT_COLUMNS = [
    'CAST(i.id AS CHAR)', 'i.name', 'i.brand', 'i.model', 'i.notes', 'i.status',
    'c.name', 'l.schrank', 'l.fach', 'r.name', 's.value', 't.name',
];

$query = mb_substr(strip_tags(getStringParam('query')), 0, 500, 'UTF-8');
$limit = max(1, min(getIntParam('limit', 50), 200));
$sortField = in_array(getStringParam('sort'), SORT_FIELDS, true) ? getStringParam('sort') : 'id';
$sortOrder = strtoupper(getStringParam('order', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
$categoryId = getIntParam('category_id');
$searchFor = getStringParam('searchFor');
$searchColumn = SEARCH_FIELDS[$searchFor] ?? null;

try {
    $conditions = [];
    $params = [];
    $types = '';

    // specs/tags werden nur für die Vollsuche gejoint (und erzwingen dort DISTINCT).
    $fullSearch = $query !== '' && $searchColumn === null;

    if ($query !== '') {
        $columns = $fullSearch ? FULLTEXT_COLUMNS : [$searchColumn];
        $like = array_map(static fn(string $col): string => "{$col} LIKE CONCAT('%', ?, '%')", $columns);
        $conditions[] = '(' . implode(' OR ', $like) . ')';
        $params = array_fill(0, count($columns), $query);
        $types = str_repeat('s', count($columns));
    }

    if ($categoryId > 0) {
        $conditions[] = '(i.category_id = ? OR c.parent_id = ?)';
        array_push($params, $categoryId, $categoryId);
        $types .= 'ii';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $distinct = $query !== '' ? 'DISTINCT' : '';
    $extraJoins = $fullSearch
        ? 'LEFT JOIN specs s ON s.item_id = i.id
           LEFT JOIN item_tags it ON it.item_id = i.id
           LEFT JOIN tags t ON t.id = it.tag_id'
        : '';

    $stmt = $db->prepare(
        "SELECT {$distinct} i.*, c.name AS category_name, p.name AS parent_category,
                r.name AS room, l.schrank AS locker, l.fach AS shelf
         FROM items i
         LEFT JOIN categories c ON c.id = i.category_id
         LEFT JOIN categories p ON p.id = c.parent_id
         LEFT JOIN locations l ON l.id = i.location_id
         LEFT JOIN rooms r ON r.id = l.room_id
         {$extraJoins}
         {$where}
         ORDER BY i.`{$sortField}` {$sortOrder}
         LIMIT ?"
    );
    $params[] = $limit;
    $stmt->bind_param($types . 'i', ...$params);
    $stmt->execute();
    $items = enrichItems($stmt->get_result()->fetch_all(MYSQLI_ASSOC));

    sendSuccess($items, [
        'count' => count($items),
        'query' => $query,
        'searchFor' => $searchFor ?: 'all',
        'sort' => ['field' => $sortField, 'order' => $sortOrder],
        'limit' => $limit,
    ]);
} catch (Throwable $e) {
    sendException($e, 'Suchfehler');
}
