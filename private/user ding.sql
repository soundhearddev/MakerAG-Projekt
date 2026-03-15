-- ═══════════════════════════════════════════════════════════════════════════
-- network_hosts.sql
-- ═══════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `network_hosts` (
    `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,

    `ip`           VARCHAR(45)   NOT NULL                COMMENT 'Letzte bekannte IP',
    `mac`          VARCHAR(17)   DEFAULT NULL            COMMENT 'aa:bb:cc:dd:ee:ff – nullable',
    `hostname`     VARCHAR(255)  DEFAULT NULL            COMMENT 'Reverse-DNS / NetBIOS',
    `vendor`       VARCHAR(100)  DEFAULT NULL            COMMENT 'Hersteller aus MAC-OUI (via nmap)',

    `first_seen`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_seen`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `seen_count`   INT UNSIGNED  NOT NULL DEFAULT 1,

    -- Manuell pflegbar
    `label`        VARCHAR(100)  DEFAULT NULL            COMMENT 'z.B. "Büro-PC Max"',
    `notes`        TEXT          DEFAULT NULL,

    PRIMARY KEY (`id`),
    UNIQUE  KEY `uq_mac`     (`mac`),        -- MAC eindeutig wenn vorhanden
    INDEX       `idx_ip`     (`ip`),
    INDEX       `idx_hostname` (`hostname`),
    INDEX       `idx_last_seen` (`last_seen`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Bekannte Netzwerkgeräte im internen Netz';


-- ─── View: Aktive Hosts letzte 24h ───────────────────────────────────────────

CREATE OR REPLACE VIEW `network_hosts_recent` AS
    SELECT id, ip, mac, hostname, vendor, label, last_seen, seen_count
    FROM `network_hosts`
    WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ORDER BY last_seen DESC;


-- ─── View: Hosts ohne Hostname (unaufgelöst) ──────────────────────────────────

CREATE OR REPLACE VIEW `network_hosts_unknown` AS
    SELECT id, ip, mac, vendor, last_seen
    FROM `network_hosts`
    WHERE hostname IS NULL
    ORDER BY last_seen DESC;


-- ─── Stored Procedure: Upsert ────────────────────────────────────────────────
-- Legt neuen Host an ODER aktualisiert ip/hostname/vendor + seen_count.
-- Matching primär über MAC (eindeutig), fallback über IP.
--
-- Aufruf: CALL upsert_host('10.0.1.42', 'aa:bb:cc:dd:ee:ff', 'desktop-max', 'Apple Inc.');

DROP PROCEDURE IF EXISTS `upsert_host`;

DELIMITER $$
CREATE PROCEDURE `upsert_host`(
    IN p_ip       VARCHAR(45),
    IN p_mac      VARCHAR(17),
    IN p_hostname VARCHAR(255),
    IN p_vendor   VARCHAR(100)
)
BEGIN
    DECLARE v_id INT UNSIGNED DEFAULT NULL;

    -- 1. Suche nach MAC (wenn vorhanden)
    IF p_mac IS NOT NULL AND p_mac != '' THEN
        SELECT id INTO v_id FROM network_hosts WHERE mac = p_mac LIMIT 1;
    END IF;

    -- 2. Fallback: Suche nach IP
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM network_hosts WHERE ip = p_ip LIMIT 1;
    END IF;

    -- 3. Update oder Insert
    IF v_id IS NOT NULL THEN
        UPDATE network_hosts SET
            ip         = p_ip,
            mac        = COALESCE(p_mac,      mac),
            hostname   = COALESCE(p_hostname, hostname),
            vendor     = COALESCE(p_vendor,   vendor),
            last_seen  = NOW(),
            seen_count = seen_count + 1
        WHERE id = v_id;
    ELSE
        INSERT INTO network_hosts (ip, mac, hostname, vendor)
        VALUES (p_ip, NULLIF(p_mac,''), NULLIF(p_hostname,''), NULLIF(p_vendor,''));
    END IF;
END$$
DELIMITER ;


SELECT 'network_hosts.sql erfolgreich ausgeführt ✓' AS status;