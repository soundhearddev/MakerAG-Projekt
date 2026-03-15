#!/usr/bin/env bash
# lookup_host.sh – IP → MAC + Hostname → DB

set -euo pipefail

# ─── Konfiguration ────────────────────────────────────────────────────────────

DB_CONF="/etc/inventar/db.conf"


# ─── Logging ──────────────────────────────────────────────────────────────────

log()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$IP] $*"; }
debug() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$IP] [DBG] $*"; }
ok()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$IP] [OK]  $*"; }

# ─── Input validieren ─────────────────────────────────────────────────────────

IP="${1:-}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BOOT] Script gestartet | PID=$$ | User=$(whoami) | IP='${IP:-<leer>}'"

[[ -z "$IP" ]]                                                  && { echo "FEHLER: Keine IP"; exit 1; }
echo "$IP" | grep -qP '^(\d{1,3}\.){3}\d{1,3}$'               || { echo "FEHLER: Ungültiges Format: $IP"; exit 1; }
echo "$IP" | grep -qP '^10\.'                                   || { echo "FEHLER: Keine 10.x IP: $IP"; exit 1; }

# ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

mysql_cmd() {
    if [[ -f "${DB_CONF:-}" ]]; then
        mysql --defaults-file="$DB_CONF" --silent --skip-column-names -e "$1" 2>/dev/null
    else
        mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" --silent --skip-column-names -e "$1" 2>/dev/null
    fi
}

normalize_mac() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/-/:/g'; }
sql_escape()    { printf '%s' "$1" | sed "s/'/''/g" | head -c 255; }

# ─── DB prüfen ────────────────────────────────────────────────────────────────

debug "Prüfe DB-Verbindung..."
mysql_cmd "SELECT 1" &>/dev/null || { log "FEHLER: DB nicht erreichbar"; exit 1; }
debug "DB OK"

# ─── 1. Ping ──────────────────────────────────────────────────────────────────

log "── Schritt 1: Ping ──"
debug "ping -c 1 -W 2 $IP"
ping -c 1 -W 2 "$IP" &>/dev/null || { log "Host nicht erreichbar – kein Eintrag"; exit 0; }
ok "Host erreichbar"

# ─── 2. MAC ───────────────────────────────────────────────────────────────────

log "── Schritt 2: MAC ──"
MAC=""

# Methode 1: arp -n
debug "Methode 1: arp -n"
ARP_OUT=$(arp -n "$IP" 2>/dev/null || true)
debug "arp Ausgabe: '${ARP_OUT:-<leer>}'"
MAC=$(echo "$ARP_OUT" | grep -v "^Address" | awk '{print $3}' | grep -P '^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$' | head -1 || true)

# Methode 2: ip neigh
if [[ -z "$MAC" ]]; then
    debug "Methode 2: ip neigh show"
    NEIGH_OUT=$(ip neigh show "$IP" 2>/dev/null || true)
    debug "ip neigh Ausgabe: '${NEIGH_OUT:-<leer>}'"
    MAC=$(echo "$NEIGH_OUT" | grep -oP '([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}' | head -1 || true)
fi

# Methode 3: nmap ARP-Ping → Cache befüllen → erneut ip neigh
if [[ -z "$MAC" ]] && command -v nmap &>/dev/null; then
    debug "Methode 3: nmap ARP-Ping (Cache befüllen)"
    nmap -sn --host-timeout 5s "$IP" &>/dev/null || true
    NEIGH_OUT2=$(ip neigh show "$IP" 2>/dev/null || true)
    debug "ip neigh nach nmap: '${NEIGH_OUT2:-<leer>}'"
    MAC=$(echo "$NEIGH_OUT2" | grep -oP '([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}' | head -1 || true)
fi

[[ -n "$MAC" ]] && MAC=$(normalize_mac "$MAC") && ok "MAC: $MAC" || log "MAC nicht ermittelbar → NULL"

# ─── 3. Vendor ────────────────────────────────────────────────────────────────

log "── Schritt 3: Vendor ──"
VENDOR=""

if [[ -n "$MAC" ]] && command -v nmap &>/dev/null; then
    TMP=$(mktemp /tmp/nmap_XXXXXX.xml)
    debug "nmap XML-Scan für Vendor..."
    nmap -sn --host-timeout 5s -oX "$TMP" "$IP" &>/dev/null || true
    VENDOR=$(grep -oP 'vendor="\K[^"]+' "$TMP" | head -1 || true)
    rm -f "$TMP"
fi

[[ -n "$VENDOR" ]] && ok "Vendor: $VENDOR" || log "Vendor nicht ermittelbar → NULL"

# ─── 4. Hostname ──────────────────────────────────────────────────────────────

log "── Schritt 4: Hostname ──"
HOSTNAME=""

# Methode 1: nmblookup (Windows NetBIOS – zuverlässigste Methode im LAN)
# Gibt den echten Windows-Computernamen zurück, unabhängig von DNS
if command -v nmblookup &>/dev/null; then
    debug "Methode 1: nmblookup -A $IP"
    NMB_OUT=$(nmblookup -A "$IP" 2>/dev/null || true)
    debug "nmblookup Ausgabe: '${NMB_OUT:-<leer>}'"
    # <00> = Workstation-Name, -GROUP filtert Domain-Namen raus
    HOSTNAME=$(echo "$NMB_OUT" | grep '<00>' | grep -v '<GROUP>' | awk '{print $1}' | head -1 | tr -d '[:space:]' || true)
    [[ -n "$HOSTNAME" ]] && debug "nmblookup Ergebnis: '$HOSTNAME'" || debug "nmblookup: kein Name gefunden"
else
    debug "Methode 1 übersprungen: nmblookup nicht installiert (sudo apt install samba-common-bin)"
fi

# Methode 2: avahi-resolve (Linux/Mac mDNS – Fallback für Nicht-Windows)
# Funktioniert für Geräte die avahi-daemon laufen haben
if [[ -z "$HOSTNAME" ]] && command -v avahi-resolve &>/dev/null; then
    debug "Methode 2: avahi-resolve -a $IP"
    AVAHI_OUT=$(avahi-resolve -a "$IP" 2>/dev/null || true)
    debug "avahi-resolve Ausgabe: '${AVAHI_OUT:-<leer>}'"
    # Ausgabe: "10.0.1.42   hostname.local" → zweite Spalte, .local entfernen
    HOSTNAME=$(echo "$AVAHI_OUT" | awk '{print $2}' | sed 's/\.local$//' | head -1 || true)
    [[ -n "$HOSTNAME" ]] && debug "avahi Ergebnis: '$HOSTNAME'" || debug "avahi: kein Name gefunden"
else
    [[ -z "$HOSTNAME" ]] && debug "Methode 2 übersprungen: avahi-resolve nicht installiert (sudo apt install avahi-utils)"
fi

[[ -n "$HOSTNAME" ]] && ok "Hostname: $HOSTNAME" || log "Hostname nicht auflösbar → NULL"

# ─── 5. DB schreiben ──────────────────────────────────────────────────────────

log "── Schritt 5: DB-Eintrag ──"

ESC_IP=$(sql_escape "$IP")
[[ -z "$MAC"      ]] && SQL_MAC="NULL"    || SQL_MAC="'$(sql_escape "$MAC")'"
[[ -z "$HOSTNAME" ]] && SQL_HOST="NULL"   || SQL_HOST="'$(sql_escape "$HOSTNAME")'"
[[ -z "$VENDOR"   ]] && SQL_VENDOR="NULL" || SQL_VENDOR="'$(sql_escape "$VENDOR")'"

SQL="CALL upsert_host('$ESC_IP', $SQL_MAC, $SQL_HOST, $SQL_VENDOR);"
debug "SQL: $SQL"
mysql_cmd "$SQL"

log "════════════════════════════════"
log "  IP       → $IP"
log "  MAC      → ${MAC:-NULL}"
log "  Hostname → ${HOSTNAME:-NULL}"
log "  Vendor   → ${VENDOR:-NULL}"
log "════════════════════════════════"
log "Fertig"