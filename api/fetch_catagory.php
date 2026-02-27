<?php
/**
 * API Endpoint: fetch_catagory.php
 * Gibt alle Kategorien aus der categories-Tabelle zurück,
 * inklusive Parent-Kategorie und Item-Anzahl.
 *
 * GET → Liste aller Kategorien mit Struktur
 */

require_once __DIR__ . '/init.php';

try {
    $result = $db->query(
        "SELECT
            c.id,
            c.name,
            c.parent_id,
            p.name AS parent_name,
            c.icon,
            COUNT(i.id) AS item_count
         FROM categories c
         LEFT JOIN categories p ON p.id = c.parent_id
         LEFT JOIN items i ON i.category_id = c.id
         GROUP BY c.id, c.name, c.parent_id, p.name, c.icon
         ORDER BY p.name ASC, c.name ASC"
    );

    $categories = $result->fetch_all(MYSQLI_ASSOC);

    // Zahlen korrekt casten
    foreach ($categories as &$cat) {
        $cat['id']         = (int) $cat['id'];
        $cat['parent_id']  = $cat['parent_id'] !== null ? (int) $cat['parent_id'] : null;
        $cat['item_count'] = (int) $cat['item_count'];
    }

    sendSuccess($categories, ['count' => count($categories)]);
} catch (Exception $e) {
    error_log('fetch_catagory.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}
