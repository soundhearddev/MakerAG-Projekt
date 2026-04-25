<?php
require_once __DIR__ . '/init.php';

try {
    // Jede Query gibt eine Zahl zurück, fetch_assoc()['c'] holt den Wert
    // COUNT(DISTINCT brand) = nur eindeutige Marken zählen (Dell doppelt = 1)
    // WHERE brand IS NOT NULL = leere Marken nicht mitzählen
    $total     = (int) $db->query("SELECT COUNT(id) AS c FROM items")->fetch_assoc()['c'];
    $cats      = (int) $db->query("SELECT COUNT(id) AS c FROM categories")->fetch_assoc()['c'];
    $brands    = (int) $db->query("SELECT COUNT(DISTINCT brand) AS c FROM items WHERE brand IS NOT NULL")->fetch_assoc()['c'];
    $locations = (int) $db->query("SELECT COUNT(id) AS c FROM locations")->fetch_assoc()['c'];
    $tags      = (int) $db->query("SELECT COUNT(id) AS c FROM tags")->fetch_assoc()['c'];

    sendSuccess([], [
        'count'      => $total,
        'statistics' => [
            'total_items' => $total,
            'categories'  => $cats,
            'brands'      => $brands,
            'locations'   => $locations,
            'tags'        => $tags,
        ],
    ]);
} catch (Exception $e) {
    error_log('count.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}