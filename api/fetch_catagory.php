<?php

require_once __DIR__ . '/init.php';

try {
    // LEFT JOINs: auch Wurzelkategorien (ohne Parent) und leere Kategorien erscheinen.
    $result = $db->query(
        'SELECT c.id, c.name, c.parent_id, p.name AS parent_name, c.icon, COUNT(i.id) AS item_count
         FROM categories c
         LEFT JOIN categories p ON p.id = c.parent_id
         LEFT JOIN items i ON i.category_id = c.id
         GROUP BY c.id, c.name, c.parent_id, p.name, c.icon
         ORDER BY p.name ASC, c.name ASC'
    );

    $categories = array_map(static function (array $cat): array {
        $cat['id'] = (int) $cat['id'];
        $cat['parent_id'] = $cat['parent_id'] !== null ? (int) $cat['parent_id'] : null;
        $cat['item_count'] = (int) $cat['item_count'];
        return $cat;
    }, $result->fetch_all(MYSQLI_ASSOC));

    sendSuccess($categories, ['count' => count($categories)]);
} catch (Throwable $e) {
    sendException($e);
}
