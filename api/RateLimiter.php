<?php
/**
 * RateLimiter – Token-Bucket via APCu (kein Redis nötig).
 *
 * Zwei unabhängige Ebenen:
 *   1. Per-IP  – schützt gegen einzelne aggressive Clients
 *   2. Global  – schützt den Server insgesamt
 *
 * Konfiguration über Konstanten (in init.php oder hier direkt setzen):
 *
 *   RL_IP_CAPACITY   – max. Tokens pro IP          (default 30)
 *   RL_IP_REFILL     – Tokens/Sekunde pro IP        (default 2)
 *   RL_GL_CAPACITY   – globales Bucket-Maximum      (default 500)
 *   RL_GL_REFILL     – globale Tokens/Sekunde        (default 50)
 *   RL_BLOCK_SECONDS – Sperrzeit nach Ausschöpfung  (default 60)
 */
class RateLimiter
{
    // ── Defaults ──────────────────────────────────────────────────────────────
    private const DEF_IP_CAP   = 10;
    private const DEF_IP_FILL  = 0.5;
    private const DEF_GL_CAP   = 500;
    private const DEF_GL_FILL  = 50;
    private const DEF_BLOCK    = 60;

    // ── Intern ────────────────────────────────────────────────────────────────
    private int   $ipCap;
    private float $ipFill;
    private int   $glCap;
    private float $glFill;
    private int   $blockSec;
    private bool  $apcuAvail;

    public function __construct()
    {
        $this->ipCap    = defined('RL_IP_CAPACITY')   ? RL_IP_CAPACITY   : self::DEF_IP_CAP;
        $this->ipFill   = defined('RL_IP_REFILL')     ? RL_IP_REFILL     : self::DEF_IP_FILL;
        $this->glCap    = defined('RL_GL_CAPACITY')   ? RL_GL_CAPACITY   : self::DEF_GL_CAP;
        $this->glFill   = defined('RL_GL_REFILL')     ? RL_GL_REFILL     : self::DEF_GL_FILL;
        $this->blockSec = defined('RL_BLOCK_SECONDS') ? RL_BLOCK_SECONDS : self::DEF_BLOCK;
        $this->apcuAvail = extension_loaded('apcu') && apcu_enabled();
    }

    /**
     * Haupteinsprungpunkt.
     * Gibt true zurück wenn der Request erlaubt ist, false wenn geblockt.
     * Setzt passende HTTP-Header (X-RateLimit-*, Retry-After).
     */
    public function check(): bool
    {
        if (!$this->apcuAvail) {
            // APCu nicht verfügbar → fail-open (kein Absturz der API)
            error_log('[RateLimiter] APCu nicht verfügbar – Rate Limiting deaktiviert');
            return true;
        }

        $ip = $this->resolveIp();

        // 1. Ist die IP hart geblockt?
        if ($this->isBlocked($ip)) {
            $retry = (int) apcu_fetch("rl:block:ttl:{$ip}");
            $this->sendHeaders(0, $this->ipCap, max(1, $retry));
            return false;
        }

        // 2. IP-Bucket prüfen
        [$ipTokens, $ipAllowed] = $this->consumeBucket("rl:ip:{$ip}", $this->ipCap, $this->ipFill);
        if (!$ipAllowed) {
            $this->blockIp($ip);
            $this->sendHeaders(0, $this->ipCap, $this->blockSec);
            return false;
        }

        // 3. Globales Bucket prüfen
        [, $glAllowed] = $this->consumeBucket('rl:global', $this->glCap, $this->glFill);
        if (!$glAllowed) {
            // Global überlastet – kurze Pause, IP nicht hard-blocken
            $this->sendHeaders(0, $this->ipCap, 5);
            return false;
        }

        // Verbleibende IP-Tokens als Header mitgeben
        $this->sendHeaders((int) $ipTokens, $this->ipCap);
        return true;
    }

    // ── Token-Bucket (APCu-basiert, lock-frei) ────────────────────────────────

    /**
     * Atomarer Token-Bucket-Schritt.
     * Gibt [verbleibende Tokens nach Consume, bool erlaubt] zurück.
     */
    private function consumeBucket(string $key, int $capacity, float $refillRate): array
    {
        $now    = microtime(true);
        $tKey   = "{$key}:tokens";
        $tsKey  = "{$key}:ts";
        $ttl    = (int) ceil($capacity / $refillRate) * 2; // sinnvoller APCu-TTL

        // Letzten Stand laden (oder frisch initialisieren)
        $tokens    = apcu_fetch($tKey);
        $lastStamp = apcu_fetch($tsKey);

        if ($tokens === false || $lastStamp === false) {
            // Erster Request für diesen Key
            $tokens    = $capacity - 1;
            $lastStamp = $now;
            apcu_store($tKey,  $tokens,    $ttl);
            apcu_store($tsKey, $lastStamp, $ttl);
            return [$tokens, true];
        }

        // Tokens seit letztem Zugriff nachfüllen
        $elapsed  = max(0.0, $now - (float) $lastStamp);
        $refilled = $elapsed * $refillRate;
        $tokens   = min($capacity, (float) $tokens + $refilled);

        apcu_store($tsKey, $now, $ttl);

        if ($tokens >= 1.0) {
            $tokens -= 1.0;
            apcu_store($tKey, $tokens, $ttl);
            return [$tokens, true];
        }

        // Bucket leer
        apcu_store($tKey, $tokens, $ttl);
        return [0, false];
    }

    // ── Hard-Block ────────────────────────────────────────────────────────────

    private function isBlocked(string $ip): bool
    {
        return (bool) apcu_fetch("rl:block:{$ip}");
    }

    private function blockIp(string $ip): void
    {
        apcu_store("rl:block:{$ip}",     true,           $this->blockSec);
        apcu_store("rl:block:ttl:{$ip}", $this->blockSec, $this->blockSec);
        error_log("[RateLimiter] IP geblockt für {$this->blockSec}s: {$ip}");
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private function resolveIp(): string
    {
        // Vertrauenswürdige Proxies (Cloudflare, eigener Reverse-Proxy) anpassen
        $trusted = ['127.0.0.1', '::1'];

        if (
            in_array($_SERVER['REMOTE_ADDR'] ?? '', $trusted, true) &&
            !empty($_SERVER['HTTP_X_FORWARDED_FOR'])
        ) {
            // Nur die erste (ursprüngliche) IP aus dem Header
            $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($forwarded[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }

        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    private function sendHeaders(int $remaining, int $limit, int $retryAfter = 0): void
    {
        header("X-RateLimit-Limit: {$limit}");
        header("X-RateLimit-Remaining: {$remaining}");
        if ($retryAfter > 0) {
            header("Retry-After: {$retryAfter}");
            header('X-RateLimit-Reset: ' . (time() + $retryAfter));
        }
    }
}