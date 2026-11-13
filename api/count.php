<?php

require_once __DIR__ . '/init.php';

try {
    $count = static fn(string $sql): int => (int) $db->query($sql)->fetch_row()[0];

    $total = $count('SELECT COUNT(id) FROM items');

    sendSuccess([], [
        'count' => $total,
        'statistics' => [
            'total_items' => $total,
            'categories' => $count('SELECT COUNT(id) FROM categories'),
            'brands' => $count('SELECT COUNT(DISTINCT brand) FROM items WHERE brand IS NOT NULL'),
            'locations' => $count('SELECT COUNT(id) FROM locations'),
            'tags' => $count('SELECT COUNT(id) FROM tags'),
        ],
    ]);
} catch (Throwable $e) {
    sendException($e);
}
