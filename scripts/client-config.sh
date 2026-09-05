#!/usr/bin/env bash
#
# Manage client configs via the admin API.
#
# Usage:
#   ./scripts/client-config.sh get <clientName>         — fetch and print config JSON
#   ./scripts/client-config.sh put <file> [file ...]    — push config file(s) to server
#
# Workflow:
#   ./scripts/client-config.sh get bathroom > configs/bathroom/bathroom.json
#   $EDITOR configs/bathroom/bathroom.json
#   ./scripts/client-config.sh put configs/bathroom/bathroom.json
#
# Env vars (all optional):
#   SERVER_URL   — default: http://localhost:8080
#   ADMIN_USER   — default: admin
#   ADMIN_PASS   — default: admin
#
# Requires: curl, jq

set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:8080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"

usage() {
    echo "Usage: $0 get <clientName>" >&2
    echo "       $0 put <file.json> [file.json ...]" >&2
    exit 1
}

[[ $# -lt 2 ]] && usage

SUBCMD=$1; shift

# Login
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"; curl -s -b "$COOKIE_JAR" -X POST "$SERVER_URL/auth/logout" > /dev/null 2>&1 || true' EXIT

LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" \
    -X POST "$SERVER_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")

if [[ "$LOGIN_STATUS" != "200" ]]; then
    echo "Login failed (HTTP $LOGIN_STATUS). Check SERVER_URL / ADMIN_USER / ADMIN_PASS." >&2
    exit 1
fi

case "$SUBCMD" in
    get)
        CLIENT=$1
        RESP=$(curl -s -w "\n%{http_code}" \
            -b "$COOKIE_JAR" \
            "$SERVER_URL/admin/clients/$CLIENT/config")
        BODY=$(echo "$RESP" | head -n -1)
        STATUS=$(echo "$RESP" | tail -n 1)
        if [[ "$STATUS" == "200" ]]; then
            echo "$BODY" | jq .
        else
            echo "Error: HTTP $STATUS — $BODY" >&2
            exit 1
        fi
        ;;

    put)
        [[ $# -eq 0 ]] && usage
        for FILE in "$@"; do
            if [[ ! -f "$FILE" ]]; then
                echo "SKIP  $FILE — file not found"
                continue
            fi
            CLIENT=$(jq -r '.name // empty' "$FILE")
            if [[ -z "$CLIENT" ]]; then
                echo "SKIP  $FILE — missing 'name' field"
                continue
            fi
            # Only send fields the endpoint accepts; drop nulls for absent fields
            PAYLOAD=$(jq '{type, userSwitchMode, defaultModules} | with_entries(select(.value != null))' "$FILE")
            RESP=$(curl -s -w "\n%{http_code}" \
                -b "$COOKIE_JAR" \
                -X PUT "$SERVER_URL/admin/clients/$CLIENT/config" \
                -H 'Content-Type: application/json' \
                -d "$PAYLOAD")
            BODY=$(echo "$RESP" | head -n -1)
            STATUS=$(echo "$RESP" | tail -n 1)
            if [[ "$STATUS" == "200" ]]; then
                echo "OK    $CLIENT  ($FILE)"
            else
                echo "FAIL  $CLIENT  HTTP $STATUS — $BODY"
            fi
        done
        ;;

    *)
        usage
        ;;
esac
