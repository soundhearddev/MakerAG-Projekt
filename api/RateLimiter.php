<?php

namespace MakerAG;

/**
 * Token-Bucket-Rate-Limiter auf Basis von APCu (benötigt php-apcu).
 *
 * Zwei unabhängige Ebenen:
 *   1. pro IP – schützt gegen einzelne aggressive Clients
 *   2. global – schützt den Server insgesamt
 *
 * Konfiguration über optionale Konstanten (z. B. in config.php):
 *
 *   RL_IP_CAPACITY   max. Tokens pro IP              (Standard 10)
 *   RL_IP_REFILL     Tokens/Sekunde pro IP           (Standard 0.5)
 *   RL_GL_CAPACITY   globales Bucket-Maximum         (Standard 500)
 *   RL_GL_REFILL     globale Tokens/Sekunde          (Standard 50)
 *   RL_BLOCK_SECONDS Sperrzeit nach Ausschöpfung     (Standard 60)
 *
 * Lesen und Schreiben des Bucket-Zustands sind nicht atomar. Bei parallelen
 * Requests derselben IP kann das Limit dadurch geringfügig überschritten
 * werden; für diesen Einsatzzweck ist das ausreichend.
 */
class RateLimiter
{
    private const DEFAULT_IP_CAPACITY = 10;
    private const DEFAULT_IP_REFILL = 0.5;
    private const DEFAULT_GLOBAL_CAPACITY = 500;
    private const DEFAULT_GLOBAL_REFILL = 50;
    private const DEFAULT_BLOCK_SECONDS = 60;

    private int $ipCapacity;
    private float $ipRefill;
    private int $globalCapacity;
    private float $globalRefill;
    private int $blockSeconds;
    private bool $apcuAvailable;

    public function __construct()
    {
        $this->ipCapacity = defined('RL_IP_CAPACITY') ? RL_IP_CAPACITY : self::DEFAULT_IP_CAPACITY;
        $this->ipRefill = defined('RL_IP_REFILL') ? RL_IP_REFILL : self::DEFAULT_IP_REFILL;
        $this->globalCapacity = defined('RL_GL_CAPACITY') ? RL_GL_CAPACITY : self::DEFAULT_GLOBAL_CAPACITY;
        $this->globalRefill = defined('RL_GL_REFILL') ? RL_GL_REFILL : self::DEFAULT_GLOBAL_REFILL;
        $this->blockSeconds = defined('RL_BLOCK_SECONDS') ? RL_BLOCK_SECONDS : self::DEFAULT_BLOCK_SECONDS;
        $this->apcuAvailable = extension_loaded('apcu') && apcu_enabled();
    }

    /**
     * Gibt true zurück, wenn der Request erlaubt ist. Setzt die
     * Header X-RateLimit-* und Retry-After.
     */
    public function check(): bool
    {
        if (!$this->apcuAvailable) {
            // Fail-open: ohne APCu läuft die API weiter, nur ungedrosselt.
            error_log('[RateLimiter] APCu nicht verfügbar – Rate Limiting deaktiviert');
            return true;
        }

        $ip = $this->resolveIp();

        $blockedUntil = (int) apcu_fetch("rl:block:{$ip}");
        if ($blockedUntil > time()) {
            $this->sendHeaders(0, $this->ipCapacity, $blockedUntil - time());
            return false;
        }

        [$ipTokens, $ipAllowed] = $this->consumeToken("rl:ip:{$ip}", $this->ipCapacity, $this->ipRefill);
        if (!$ipAllowed) {
            $this->blockIp($ip);
            $this->sendHeaders(0, $this->ipCapacity, $this->blockSeconds);
            return false;
        }

        [, $globalAllowed] = $this->consumeToken('rl:global', $this->globalCapacity, $this->globalRefill);
        if (!$globalAllowed) {
            // Server überlastet: kurze Pause, die IP wird nicht gesperrt.
            $this->sendHeaders(0, $this->ipCapacity, 5);
            return false;
        }

        $this->sendHeaders((int) $ipTokens, $this->ipCapacity);
        return true;
    }

    /**
     * Füllt den Bucket anhand der vergangenen Zeit auf und entnimmt einen Token.
     *
     * @return array{0: float, 1: bool} verbleibende Tokens, erlaubt
     */
    private function consumeToken(string $key, int $capacity, float $refillRate): array
    {
        $now = microtime(true);
        $ttl = (int) ceil($capacity / $refillRate) * 2;

        $state = apcu_fetch($key);
        if (!is_array($state)) {
            $state = ['tokens' => (float) $capacity, 'ts' => $now];
        }

        $elapsed = max(0.0, $now - $state['ts']);
        $tokens = min((float) $capacity, $state['tokens'] + $elapsed * $refillRate);

        $allowed = $tokens >= 1.0;
        if ($allowed) {
            $tokens -= 1.0;
        }

        apcu_store($key, ['tokens' => $tokens, 'ts' => $now], $ttl);

        return [$tokens, $allowed];
    }

    private function blockIp(string $ip): void
    {
        apcu_store("rl:block:{$ip}", time() + $this->blockSeconds, $this->blockSeconds);
        error_log("[RateLimiter] IP geblockt für {$this->blockSeconds}s: {$ip}");
    }

    private function resolveIp(): string
    {
        // Nur hinter einem vertrauenswürdigen Proxy wird X-Forwarded-For ausgewertet.
        $trustedProxies = ['127.0.0.1', '::1'];
        $remote = $_SERVER['REMOTE_ADDR'] ?? '';

        if (in_array($remote, $trustedProxies, true) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $forwarded = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
            if (filter_var($forwarded, FILTER_VALIDATE_IP)) {
                return $forwarded;
            }
        }

        return $remote !== '' ? $remote : '0.0.0.0';
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
