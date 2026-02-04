<?php
/**
 * DEBUG HELPER SCRIPT
 * 
 * Dieses Script hilft beim Debuggen von PHP-Problemen
 * Rufe es auf: /api/debug.php
 * 
 * WICHTIG: Vor Production-Deploy LÖSCHEN oder deaktivieren!
 */

// =============================================================================
// SECURITY CHECK - Nur in Development verwenden!
// =============================================================================
$ALLOWED_IPS = ['127.0.0.1', '::1', 'localhost'];
$CLIENT_IP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

if (!in_array($CLIENT_IP, $ALLOWED_IPS) && $_SERVER['SERVER_NAME'] !== 'localhost') {
    http_response_code(403);
    die('Access Denied');
}

// =============================================================================
// ERROR DISPLAY aktivieren
// =============================================================================
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

header("Content-Type: text/html; charset=UTF-8");

?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug Helper</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #4ec9b0; margin-bottom: 20px; }
        h2 { color: #569cd6; margin: 30px 0 15px; border-bottom: 2px solid #569cd6; padding-bottom: 5px; }
        .section {
            background: #252526;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            border-left: 4px solid #4ec9b0;
        }
        .success { border-left-color: #4ec9b0; }
        .error { border-left-color: #f48771; }
        .warning { border-left-color: #dcdcaa; }
        .info { border-left-color: #569cd6; }
        pre {
            background: #1e1e1e;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .status-good { color: #4ec9b0; }
        .status-bad { color: #f48771; }
        .status-warn { color: #dcdcaa; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        table td, table th {
            padding: 8px;
            border: 1px solid #3e3e42;
            text-align: left;
        }
        table th {
            background: #2d2d30;
            color: #569cd6;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #0e639c;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 5px;
        }
        .btn:hover { background: #1177bb; }
        code {
            background: #2d2d30;
            padding: 2px 6px;
            border-radius: 3px;
            color: #ce9178;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Debug Helper</h1>
        <p>System-Informationen und Diagnose-Tools</p>

        <?php
        // =============================================================================
        // PHP ENVIRONMENT
        // =============================================================================
        ?>
        <div class="section info">
            <h2>📋 PHP Environment</h2>
            <table>
                <tr>
                    <th>Parameter</th>
                    <th>Wert</th>
                </tr>
                <tr>
                    <td>PHP Version</td>
                    <td class="<?= version_compare(PHP_VERSION, '7.4.0', '>=') ? 'status-good' : 'status-bad' ?>">
                        <?= PHP_VERSION ?>
                        <?= version_compare(PHP_VERSION, '7.4.0', '>=') ? '✓' : '✗ (mindestens 7.4 empfohlen)' ?>
                    </td>
                </tr>
                <tr>
                    <td>Error Reporting</td>
                    <td><?= error_reporting() ?> (<?= ini_get('display_errors') ? 'AN' : 'AUS' ?>)</td>
                </tr>
                <tr>
                    <td>Error Log</td>
                    <td><?= ini_get('error_log') ?: 'Nicht konfiguriert' ?></td>
                </tr>
                <tr>
                    <td>Memory Limit</td>
                    <td><?= ini_get('memory_limit') ?></td>
                </tr>
                <tr>
                    <td>Max Execution Time</td>
                    <td><?= ini_get('max_execution_time') ?>s</td>
                </tr>
                <tr>
                    <td>Upload Max Filesize</td>
                    <td><?= ini_get('upload_max_filesize') ?></td>
                </tr>
            </table>
        </div>

        <?php
        // =============================================================================
        // CONFIG FILE CHECK
        // =============================================================================
        $configPath = '/var/www/secure/config.php';
        $configExists = file_exists($configPath);
        $configReadable = $configExists && is_readable($configPath);
        ?>
        <div class="section <?= $configReadable ? 'success' : 'error' ?>">
            <h2>⚙️ Config File</h2>
            <table>
                <tr>
                    <td>Pfad</td>
                    <td><code><?= $configPath ?></code></td>
                </tr>
                <tr>
                    <td>Existiert</td>
                    <td class="<?= $configExists ? 'status-good' : 'status-bad' ?>">
                        <?= $configExists ? '✓ Ja' : '✗ Nein' ?>
                    </td>
                </tr>
                <tr>
                    <td>Lesbar</td>
                    <td class="<?= $configReadable ? 'status-good' : 'status-bad' ?>">
                        <?= $configReadable ? '✓ Ja' : '✗ Nein' ?>
                    </td>
                </tr>
            </table>

            <?php if ($configReadable): ?>
                <p><strong>Config wird geladen...</strong></p>
                <?php
                try {
                    require_once $configPath;
                    echo '<p class="status-good">✓ Config erfolgreich geladen</p>';
                    
                    if (class_exists('Database')) {
                        echo '<p class="status-good">✓ Database-Klasse gefunden</p>';
                    } else {
                        echo '<p class="status-bad">✗ Database-Klasse nicht gefunden!</p>';
                    }
                } catch (Throwable $e) {
                    echo '<p class="status-bad">✗ Fehler beim Laden: ' . htmlspecialchars($e->getMessage()) . '</p>';
                    echo '<pre>' . htmlspecialchars($e->getTraceAsString()) . '</pre>';
                }
                ?>
            <?php endif; ?>
        </div>

        <?php
        // =============================================================================
        // DATABASE CONNECTION TEST
        // =============================================================================
        ?>
        <div class="section">
            <h2>🗄️ Database Connection</h2>
            <?php
            if (class_exists('Database')):
                try {
                    $db = Database::connect();
                    echo '<p class="status-good">✓ Verbindung erfolgreich hergestellt</p>';
                    
                    echo '<table>';
                    echo '<tr><th>Parameter</th><th>Wert</th></tr>';
                    echo '<tr><td>Host Info</td><td>' . htmlspecialchars($db->host_info) . '</td></tr>';
                    echo '<tr><td>Server Version</td><td>' . htmlspecialchars($db->server_version) . '</td></tr>';
                    echo '<tr><td>Protocol Version</td><td>' . $db->protocol_version . '</td></tr>';
                    echo '<tr><td>Character Set</td><td>' . htmlspecialchars($db->character_set_name()) . '</td></tr>';
                    echo '</table>';

                    // Test Query
                    $result = $db->query("SHOW TABLES");
                    if ($result) {
                        $tables = [];
                        while ($row = $result->fetch_array()) {
                            $tables[] = $row[0];
                        }
                        echo '<p><strong>Tabellen in der Datenbank:</strong></p>';
                        echo '<pre>' . implode("\n", $tables) . '</pre>';
                        
                        // Check if 'items' table exists
                        if (in_array('items', $tables)) {
                            echo '<p class="status-good">✓ Tabelle "items" gefunden</p>';
                            
                            // Get table structure
                            $struct = $db->query("DESCRIBE items");
                            if ($struct) {
                                echo '<p><strong>Tabellenstruktur "items":</strong></p>';
                                echo '<table><tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th></tr>';
                                while ($field = $struct->fetch_assoc()) {
                                    echo '<tr>';
                                    echo '<td>' . htmlspecialchars($field['Field']) . '</td>';
                                    echo '<td>' . htmlspecialchars($field['Type']) . '</td>';
                                    echo '<td>' . htmlspecialchars($field['Null']) . '</td>';
                                    echo '<td>' . htmlspecialchars($field['Key']) . '</td>';
                                    echo '<td>' . htmlspecialchars($field['Default'] ?? 'NULL') . '</td>';
                                    echo '</tr>';
                                }
                                echo '</table>';
                            }
                            
                            // Count rows
                            $count = $db->query("SELECT COUNT(*) as cnt FROM items");
                            if ($count) {
                                $row = $count->fetch_assoc();
                                echo '<p>Anzahl Einträge: <strong>' . $row['cnt'] . '</strong></p>';
                            }
                        } else {
                            echo '<p class="status-bad">✗ Tabelle "items" nicht gefunden!</p>';
                        }
                    }
                    
                    $db->close();
                } catch (Throwable $e) {
                    echo '<p class="status-bad">✗ Verbindungsfehler: ' . htmlspecialchars($e->getMessage()) . '</p>';
                    echo '<pre>' . htmlspecialchars($e->getTraceAsString()) . '</pre>';
                }
            else:
                echo '<p class="status-bad">✗ Database-Klasse nicht verfügbar</p>';
            endif;
            ?>
        </div>

        <?php
        // =============================================================================
        // FILE PERMISSIONS
        // =============================================================================
        ?>
        <div class="section">
            <h2>📁 File Permissions</h2>
            <?php
            $checkPaths = [
                '/var/www/logs' => 'Log-Verzeichnis',
                '/var/www/logs/php_errors.log' => 'PHP Error Log',
                '/var/www/public' => 'Public Verzeichnis',
                '/var/www/public/docs' => 'Docs Verzeichnis',
                $configPath => 'Config File'
            ];
            
            echo '<table>';
            echo '<tr><th>Pfad</th><th>Existiert</th><th>Lesbar</th><th>Schreibbar</th><th>Permissions</th></tr>';
            
            foreach ($checkPaths as $path => $desc) {
                $exists = file_exists($path);
                $readable = $exists && is_readable($path);
                $writable = $exists && is_writable($path);
                $perms = $exists ? substr(sprintf('%o', fileperms($path)), -4) : 'N/A';
                
                echo '<tr>';
                echo '<td><strong>' . htmlspecialchars($desc) . '</strong><br><code>' . htmlspecialchars($path) . '</code></td>';
                echo '<td class="' . ($exists ? 'status-good' : 'status-bad') . '">' . ($exists ? '✓' : '✗') . '</td>';
                echo '<td class="' . ($readable ? 'status-good' : 'status-bad') . '">' . ($readable ? '✓' : '✗') . '</td>';
                echo '<td class="' . ($writable ? 'status-good' : 'status-warn') . '">' . ($writable ? '✓' : '✗') . '</td>';
                echo '<td>' . $perms . '</td>';
                echo '</tr>';
            }
            
            echo '</table>';
            ?>
        </div>

        <?php
        // =============================================================================
        // PHP EXTENSIONS
        // =============================================================================
        ?>
        <div class="section">
            <h2>🔌 PHP Extensions</h2>
            <?php
            $requiredExtensions = [
                'mysqli' => 'MySQL Database',
                'json' => 'JSON Support',
                'mbstring' => 'Multibyte String',
                'openssl' => 'SSL/TLS',
                'curl' => 'cURL',
                'fileinfo' => 'File Info',
            ];
            
            echo '<table>';
            echo '<tr><th>Extension</th><th>Beschreibung</th><th>Status</th></tr>';
            
            foreach ($requiredExtensions as $ext => $desc) {
                $loaded = extension_loaded($ext);
                echo '<tr>';
                echo '<td><code>' . $ext . '</code></td>';
                echo '<td>' . $desc . '</td>';
                echo '<td class="' . ($loaded ? 'status-good' : 'status-bad') . '">' . ($loaded ? '✓ Geladen' : '✗ Nicht verfügbar') . '</td>';
                echo '</tr>';
            }
            
            echo '</table>';
            ?>
        </div>

        <?php
        // =============================================================================
        // ERROR LOG
        // =============================================================================
        $errorLog = ini_get('error_log');
        if ($errorLog && file_exists($errorLog)):
        ?>
        <div class="section warning">
            <h2>📄 Error Log (letzte 50 Zeilen)</h2>
            <?php
            $lines = @file($errorLog);
            if ($lines) {
                $lastLines = array_slice($lines, -50);
                echo '<pre>' . htmlspecialchars(implode('', $lastLines)) . '</pre>';
            } else {
                echo '<p>Log-Datei konnte nicht gelesen werden oder ist leer</p>';
            }
            ?>
        </div>
        <?php endif; ?>

        <?php
        // =============================================================================
        // TEST SEARCH QUERY
        // =============================================================================
        ?>
        <div class="section">
            <h2>🔍 Test Search Query</h2>
            <p>Teste die Suchfunktion direkt:</p>
            
            <?php
            if (isset($_GET['test_query'])) {
                $testQuery = $_GET['test_query'];
                echo '<h3>Teste Query: <code>' . htmlspecialchars($testQuery) . '</code></h3>';
                
                try {
                    require_once $configPath;
                    $db = Database::connect();
                    $db->set_charset('utf8mb4');
                    
                    $limit = 10;
                    $sortField = 'id';
                    $sortOrder = 'DESC';
                    
                    if ($testQuery === '') {
                        $sql = "SELECT * FROM items ORDER BY `{$sortField}` {$sortOrder} LIMIT ?";
                        $stmt = $db->prepare($sql);
                        $stmt->bind_param("i", $limit);
                    } else {
                        $sql = "SELECT * FROM items
                                WHERE CAST(`id` AS CHAR) LIKE CONCAT('%', ?, '%')
                                   OR `name` LIKE CONCAT('%', ?, '%')
                                   OR `category` LIKE CONCAT('%', ?, '%')
                                   OR `subcategory` LIKE CONCAT('%', ?, '%')
                                   OR `brand` LIKE CONCAT('%', ?, '%')
                                   OR `model` LIKE CONCAT('%', ?, '%')
                                   OR `serial` LIKE CONCAT('%', ?, '%')
                                   OR CAST(`quantity` AS CHAR) LIKE CONCAT('%', ?, '%')
                                   OR `locker` LIKE CONCAT('%', ?, '%')
                                   OR `notes` LIKE CONCAT('%', ?, '%')
                                   OR `docs_link` LIKE CONCAT('%', ?, '%')
                                ORDER BY `{$sortField}` {$sortOrder}
                                LIMIT ?";
                        $stmt = $db->prepare($sql);
                        $stmt->bind_param("sssssssssssi", 
                            $testQuery, $testQuery, $testQuery, $testQuery, $testQuery,
                            $testQuery, $testQuery, $testQuery, $testQuery, $testQuery,
                            $testQuery, $limit);
                    }
                    
                    echo '<p><strong>SQL Query:</strong></p>';
                    echo '<pre>' . htmlspecialchars($sql) . '</pre>';
                    
                    $stmt->execute();
                    $result = $stmt->get_result();
                    $items = $result->fetch_all(MYSQLI_ASSOC);
                    
                    echo '<p class="status-good">✓ Query erfolgreich ausgeführt</p>';
                    echo '<p><strong>Ergebnisse: ' . count($items) . '</strong></p>';
                    
                    if (count($items) > 0) {
                        echo '<pre>' . htmlspecialchars(json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
                    }
                    
                    $stmt->close();
                    $db->close();
                    
                } catch (Throwable $e) {
                    echo '<p class="status-bad">✗ Fehler: ' . htmlspecialchars($e->getMessage()) . '</p>';
                    echo '<pre>' . htmlspecialchars($e->getTraceAsString()) . '</pre>';
                }
            } else {
                ?>
                <form method="get">
                    <input type="text" name="test_query" placeholder="Suchbegriff eingeben" style="padding: 10px; width: 300px; background: #2d2d30; color: white; border: 1px solid #3e3e42; border-radius: 4px;">
                    <button type="submit" class="btn">Suche testen</button>
                </form>
                <p><small>Leer lassen um alle Einträge zu laden</small></p>
                <?php
            }
            ?>
        </div>

        <?php
        // =============================================================================
        // ACTIONS
        // =============================================================================
        ?>
        <div class="section info">
            <h2>🛠️ Aktionen</h2>
            <a href="?test_query=" class="btn">Alle Items laden</a>
            <a href="?test_query=test" class="btn">Suche "test"</a>
            <a href="?" class="btn">Seite neu laden</a>
            <a href="../" class="btn">Zurück zur App</a>
        </div>

        <div class="section">
            <h2>📝 Hinweise</h2>
            <ul style="list-style-position: inside;">
                <li>Diese Debug-Seite sollte NUR in Development verfügbar sein</li>
                <li>Entferne sie vor dem Production-Deploy</li>
                <li>Überprüfe die Error-Logs für detaillierte Fehlerinformationen</li>
                <li>Stelle sicher, dass alle Pfade und Permissions korrekt sind</li>
            </ul>
        </div>
    </div>
</body>
</html>
