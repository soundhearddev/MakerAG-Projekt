
<?php
require_once __DIR__ . '/init.php';

try {
    // GROUP BY = Kategorien zusammenfassen damit COUNT funktioniert
    // COUNT(i.id) = wie viele Items haben diese Kategorie
    // (LEFT JOIN items damit auch Kategorien ohne Items erscheinen, mit COUNT 0)
    //
    // Self-Join auf categories:
    //   c = die Kategorie selbst
    //   p = die Eltern-Kategorie (parent_id zeigt auf eine andere Zeile derselben Tabelle)
    // LEFT JOIN damit auch Root-Kategorien (ohne parent) auftauchen
    //
    // ORDER BY p.name ASC, c.name ASC = erst nach Elternkategorie, dann alphabetisch
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

    // MySQL gibt Zahlen manchmal als Strings zurück – explizit zu int casten
    foreach ($categories as &$cat) {         // & = Referenz, ändert das Original-Array
        $cat['id']         = (int) $cat['id'];
        // !== null check: parent_id darf null sein (Root-Kategorie hat kein Parent)
        $cat['parent_id']  = $cat['parent_id'] !== null ? (int) $cat['parent_id'] : null;
        $cat['item_count'] = (int) $cat['item_count'];
    }

    sendSuccess($categories, ['count' => count($categories)]);
} catch (Exception $e) {
    error_log('fetch_catagory.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}
