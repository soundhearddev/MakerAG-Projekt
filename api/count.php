<?php
/**
 * API Endpoint: count.php
 * Gibt die Gesamtanzahl der Items sowie zusätzliche Statistiken zurück.
 *
 * GET → { count, statistics: { total_items, categories, brands } }
 */

require_once __DIR__ . './init.php';

try {
    $total = (int) $db->query("SELECT COUNT(*) as c FROM items")->fetch_assoc()['c'];
    $cats  = (int) $db->query("SELECT COUNT(DISTINCT category) as c FROM items WHERE category IS NOT NULL")->fetch_assoc()['c'];
    $brands = (int) $db->query("SELECT COUNT(DISTINCT brand) as c FROM items WHERE brand IS NOT NULL")->fetch_assoc()['c'];

    sendSuccess([], [
        'count'      => $total,
        'statistics' => [
            'total_items' => $total,
            'categories'  => $cats,
            'brands'      => $brands,
        ],
    ]);
} catch (Exception $e) {
    error_log('count.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}