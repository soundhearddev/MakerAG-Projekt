<?php
/**
 * API Endpoint: fetch_locker.php
 * Gibt alle Schränke (Locker) zurück, mit den darin enthaltenen Items.
 *
 * GET ?locker=S         → Items in Schrank "S"
 * GET ?locker=all       → Alle Schränke als Übersicht mit Item-Counts
 * GET (kein Parameter)  → Alle verfügbaren Schränke als Liste
 */

require_once __DIR__ . '/init.php';

$locker = getStringParam('locker');

try {
    if ($locker === '' || $locker === 'all') {
        // ─── Alle Schränke mit Item-Anzahl ─────────────────────────────────────
        $result = $db->query(
            "SELECT 
                l.schrank AS locker,
                COUNT(i.id) AS item_count,
                GROUP_CONCAT(DISTINCT l.regal ORDER BY l.regal ASC SEPARATOR ',') AS shelves,
                l.room
             FROM locations l
             LEFT JOIN items i ON i.location_id = l.id
             GROUP BY l.schrank, l.room
             ORDER BY l.schrank ASC"
        );
        $lockers = $result->fetch_all(MYSQLI_ASSOC);
        
        foreach ($lockers as &$l) {
            $l['item_count'] = (int) $l['item_count'];
            $l['shelves'] = $l['shelves'] ? array_unique(explode(',', $l['shelves'])) : [];
        }
        
        sendSuccess($lockers, ['count' => count($lockers)]);
    } else {
        // ─── Alle Items in einem bestimmten Schrank ─────────────────────────────
        $stmt = $db->prepare(
            "SELECT i.*, 
                    c.name AS category_name, 
                    p.name AS parent_category,
                    l.room, 
                    l.schrank AS locker, 
                    l.regal AS shelf, 
                    l.position
             FROM items i
             LEFT JOIN categories c ON c.id = i.category_id
             LEFT JOIN categories p ON p.id = c.parent_id
             LEFT JOIN locations l ON l.id = i.location_id
             WHERE l.schrank = ?
             ORDER BY l.regal ASC, i.name ASC"
        );
        $stmt->bind_param('s', $locker);
        $stmt->execute();
        $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $items = enrichItems($items);
        
        // Items nach Regal gruppieren
        $byShelf = [];
        foreach ($items as $item) {
            $shelf = $item['shelf'] ?? 'Unbekannt';
            $byShelf[$shelf][] = $item;
        }
        ksort($byShelf);
        
        sendSuccess($items, [
            'count'    => count($items),
            'locker'   => $locker,
            'by_shelf' => $byShelf,
            'shelves'  => array_keys($byShelf),
        ]);
    }
} catch (Exception $e) {
    error_log('fetch-locker.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}