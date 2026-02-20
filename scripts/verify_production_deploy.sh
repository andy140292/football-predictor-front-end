#!/usr/bin/env bash
set -euo pipefail

WEB_DOMAIN="${WEB_DOMAIN:-futbolconu.com}"
WWW_DOMAIN="${WWW_DOMAIN:-www.futbolconu.com}"
API_DOMAIN="${API_DOMAIN:-api.futbolconu.com}"

check_http() {
  local url="$1"
  local label="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$url")"
  case "$code" in
    200|301|302|307|308)
      echo "[OK] $label -> $url ($code)"
      ;;
    *)
      echo "[FAIL] $label -> $url ($code)"
      exit 1
      ;;
  esac
}

check_cors_origin() {
  local origin="$1"
  local headers
  headers="$(mktemp)"
  curl -sS -o /dev/null -D "$headers" \
    -X OPTIONS "https://${API_DOMAIN}/predict" \
    -H "Origin: ${origin}" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: authorization,content-type"

  if grep -i -q "^access-control-allow-origin: ${origin}$" "$headers"; then
    echo "[OK] CORS allow-origin for ${origin}"
  else
    echo "[FAIL] Missing CORS allow-origin for ${origin}"
    echo "Response headers:"
    cat "$headers"
    rm -f "$headers"
    exit 1
  fi
  rm -f "$headers"
}

echo "== Domain/HTTPS checks =="
check_http "https://${WEB_DOMAIN}" "Apex domain"
check_http "https://${WWW_DOMAIN}" "WWW domain"
check_http "https://${API_DOMAIN}/healthz" "API health endpoint"

echo
echo "== API health response =="
curl -sS "https://${API_DOMAIN}/healthz"
echo

echo
echo "== CORS checks =="
check_cors_origin "https://${WEB_DOMAIN}"
check_cors_origin "https://${WWW_DOMAIN}"

echo
echo "All production deployment checks passed."
