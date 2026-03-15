-- ═══════════════════════════════════════════════════════════════════════════
-- logs_table.sql – Logging-Tabelle für das Inventarsystem
--
-- Verwendung:
--   mysql -u USER -p DATENBANKNAME < logs_table.sql
--
-- Enthält:
--   - Tabelle `logs` mit vollständigem Schema
--   - Index-Strategie für performante Abfragen
--   - View `logs_recent` für schnellen Zugriff auf letzte Einträge
--   - Stored Procedure `cleanup_logs` für automatisches Bereinigen
--   - Event für tägliches Auto-Cleanup (optional aktivieren)
-- ═══════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ─── Tabelle `logs` ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `logs` (
    `id`          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,

    -- Zeitstempel (automatisch vom DB-Server gesetzt für Konsistenz)
    `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Log-Level: debug | info | warning | error
    `level`       ENUM('debug','info','warning','error')
                                   NOT NULL DEFAULT 'info',

    -- Was ist passiert?  z.B. 'page_view', 'item_created', 'overlay_accepted'
    `action`      VARCHAR(100)     NOT NULL,

    -- Freitext-Detail, z.B. "ID 42: Raspberry Pi"
    `detail`      VARCHAR(512)     DEFAULT NULL,

    -- Netzwerk & Client
    `ip`          VARCHAR(45)      DEFAULT NULL   COMMENT 'IPv4 oder IPv6',
    `user_agent`  VARCHAR(512)     DEFAULT NULL,
    `browser`     VARCHAR(100)     DEFAULT NULL,
    `os`          VARCHAR(100)     DEFAULT NULL,
    `device_type` ENUM('desktop','mobile','tablet','unknown')
                                   DEFAULT 'unknown',
    `language`    VARCHAR(64)      DEFAULT NULL,

    -- Request-Kontext
    `method`      ENUM('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')
                                   DEFAULT NULL,
    `url`         VARCHAR(512)     DEFAULT NULL,
    `referrer`    VARCHAR(512)     DEFAULT NULL,

    -- Session
    `session_id`  VARCHAR(128)     DEFAULT NULL,

    -- Flexible Zusatzdaten als JSON (z.B. item_id, spec_count, …)
    `extra_data`  JSON             DEFAULT NULL,

    PRIMARY KEY (`id`),

    -- Häufigste Abfragen: nach Zeit filtern / sortieren
    INDEX `idx_created_at` (`created_at`),

    -- Nach Level filtern (z.B. nur errors anzeigen)
    INDEX `idx_level`      (`level`),

    -- Nach Action filtern (z.B. nur 'item_created')
    INDEX `idx_action`     (`action`),

    -- Nach IP filtern (z.B. für Abuse-Erkennung)
    INDEX `idx_ip`         (`ip`),

    -- Session-Tracking
    INDEX `idx_session`    (`session_id`),

    -- Composite-Index für die häufigste Kombination: level + created_at
    INDEX `idx_level_time` (`level`, `created_at`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Aktions- und Zugriffslog für das Inventarsystem';


-- ─── View: Letzte 500 Einträge (für Admin-Panel) ─────────────────────────────

CREATE OR REPLACE VIEW `logs_recent` AS
    SELECT
        id,
        created_at,
        level,
        action,
        detail,
        ip,
        browser,
        os,
        device_type,
        method,
        url,
        session_id,
        extra_data
    FROM `logs`
    ORDER BY id DESC
    LIMIT 500;


-- ─── View: Fehler-Log ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW `logs_errors` AS
    SELECT *
    FROM `logs`
    WHERE level IN ('error', 'warning')
    ORDER BY id DESC;


-- ─── View: Tages-Statistik ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW `logs_daily_stats` AS
    SELECT
        DATE(created_at)                               AS `date`,
        COUNT(*)                                       AS total_requests,
        SUM(level = 'error')                           AS errors,
        SUM(level = 'warning')                         AS warnings,
        SUM(action = 'item_created')                   AS items_created,
        SUM(action = 'item_deleted')                   AS items_deleted,
        SUM(action = 'page_view')                      AS page_views,
        SUM(action = 'overlay_accepted')               AS overlay_accepts,
        COUNT(DISTINCT ip)                             AS unique_ips,
        COUNT(DISTINCT session_id)                     AS unique_sessions,
        SUM(device_type = 'mobile')                    AS mobile_visits,
        SUM(device_type = 'desktop')                   AS desktop_visits
    FROM `logs`
    GROUP BY DATE(created_at)
    ORDER BY `date` DESC;


-- ─── Stored Procedure: Alte Logs aufräumen ───────────────────────────────────
-- Aufruf: CALL cleanup_logs(90);  → löscht alle Einträge älter als 90 Tage

DROP PROCEDURE IF EXISTS `cleanup_logs`;

DELIMITER $$
CREATE PROCEDURE `cleanup_logs`(IN keep_days INT)
BEGIN
    DECLARE deleted_count INT DEFAULT 0;

    IF keep_days < 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'keep_days muss mindestens 1 sein';
    END IF;

    DELETE FROM `logs`
    WHERE created_at < DATE_SUB(NOW(), INTERVAL keep_days DAY);

    SET deleted_count = ROW_COUNT();

    -- Ergebnis zurückgeben
    SELECT
        deleted_count            AS deleted_rows,
        NOW()                    AS cleanup_time,
        keep_days                AS kept_days,
        DATE_SUB(NOW(), INTERVAL keep_days DAY) AS deleted_before;
END$$
DELIMITER ;


-- ─── Optionales Event: automatischer täglicher Cleanup ───────────────────────
-- Aktivieren mit: SET GLOBAL event_scheduler = ON;
-- Kommentar entfernen und anpassen:

/*
DROP EVENT IF EXISTS `evt_cleanup_logs`;

CREATE EVENT `evt_cleanup_logs`
    ON SCHEDULE EVERY 1 DAY
    STARTS CURRENT_TIMESTAMP
    DO
        CALL cleanup_logs(90);
*/


-- ─── Testdaten (optional, auskommentiert) ─────────────────────────────────────

/*
INSERT INTO `logs` (level, action, detail, ip, browser, os, device_type, method, url, session_id) VALUES
('info',    'page_view',     NULL,                      '127.0.0.1', 'Chrome 120', 'Windows 10/11', 'desktop', 'GET',  '/index.html', 'abc123'),
('info',    'overlay_accepted', NULL,                   '127.0.0.1', 'Chrome 120', 'Windows 10/11', 'desktop', 'POST', '/api.php',    'abc123'),
('info',    'item_created',  'ID 1: Raspberry Pi 4',    '127.0.0.1', 'Chrome 120', 'Windows 10/11', 'desktop', 'POST', '/api.php',    'abc123'),
('warning', 'csrf_violation', 'Ungültiger Token',       '10.0.0.1',  'curl/7.88',  'Linux',         'desktop', 'POST', '/api.php',    NULL),
('error',   'item_error',    'Datenbankfehler',         '127.0.0.1', 'Firefox 120','Linux',         'desktop', 'POST', '/api.php',    'def456');
*/


-- ─── Ausgabe ─────────────────────────────────────────────────────────────────

SELECT 'logs_table.sql erfolgreich ausgeführt ✓' AS status;
SELECT
    'logs'             AS `table`,
    COUNT(*)           AS `rows`
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'logs'
UNION ALL
SELECT 'logs_recent view', NULL
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'logs_recent';