-- ═══════════════════════════════════════════════════════════════════════════
-- users.sql – Tabelle für erkannte Netzwerkgeräte / User
-- Collation explizit utf8mb4_unicode_ci überall gesetzt
-- ═══════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Tabelle `users` ─────────────────────────────────────────────────────────

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `ip`          VARCHAR(45)   COLLATE utf8mb4_unicode_ci NOT NULL,
    `mac`         VARCHAR(17)   COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `hostname`    VARCHAR(255)  COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `vendor`      VARCHAR(100)  COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `label`       VARCHAR(100)  COLLATE utf8mb4_unicode_ci DEFAULT NULL  COMMENT 'Manueller Anzeigename z.B. Büro-PC Max',
    `notes`       TEXT          COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `first_seen`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_seen`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `seen_count`  INT UNSIGNED  NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`),
    UNIQUE  KEY `uq_mac`        (`mac`),
    INDEX       `idx_ip`        (`ip`),
    INDEX       `idx_hostname`  (`hostname`),
    INDEX       `idx_last_seen` (`last_seen`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Erkannte Netzwerkgeräte mit IP, MAC und Hostname';


-- ─── Stored Procedure: upsert_user ───────────────────────────────────────────

DROP PROCEDURE IF EXISTS `upsert_user`;

DELIMITER $$
CREATE PROCEDURE `upsert_user`(
    IN p_ip       VARCHAR(45)  CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_mac      VARCHAR(17)  CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_hostname VARCHAR(255) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_vendor   VARCHAR(100) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
    DECLARE v_id INT UNSIGNED DEFAULT NULL;

    -- Suche zuerst nach MAC
    IF p_mac IS NOT NULL AND p_mac != '' THEN
        SELECT id INTO v_id FROM users WHERE mac = p_mac LIMIT 1;
    END IF;

    -- Fallback: Suche nach IP
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM users WHERE ip = p_ip LIMIT 1;
    END IF;

    -- Update oder Insert
    IF v_id IS NOT NULL THEN
        UPDATE users SET
            ip         = p_ip,
            mac        = COALESCE(NULLIF(p_mac,''),      mac),
            hostname   = COALESCE(NULLIF(p_hostname,''), hostname),
            vendor     = COALESCE(NULLIF(p_vendor,''),   vendor),
            last_seen  = NOW(),
            seen_count = seen_count + 1
        WHERE id = v_id;
    ELSE
        INSERT INTO users (ip, mac, hostname, vendor)
        VALUES (
            p_ip,
            NULLIF(p_mac,''),
            NULLIF(p_hostname,''),
            NULLIF(p_vendor,'')
        );
    END IF;
END$$
DELIMITER ;


-- ─── Views ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW `users_recent` AS
    SELECT id, ip, mac, hostname, vendor, label, last_seen, seen_count
    FROM `users`
    WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ORDER BY last_seen DESC;

CREATE OR REPLACE VIEW `users_unknown` AS
    SELECT id, ip, mac, vendor, last_seen
    FROM `users`
    WHERE hostname IS NULL
    ORDER BY last_seen DESC;


-- ─── Test ─────────────────────────────────────────────────────────────────────

CALL upsert_user('10.0.0.1', 'aa:bb:cc:dd:ee:ff', 'test-pc', 'TestVendor');
CALL upsert_user('10.0.0.1', 'aa:bb:cc:dd:ee:ff', 'test-pc', 'TestVendor');  -- Update testen

SELECT * FROM users;
DELETE FROM users WHERE ip = '10.0.0.1';  -- Testdaten wieder löschen

SELECT 'users.sql erfolgreich ✓' AS status;