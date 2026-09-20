#!/bin/bash
# usage: itch_dl.sh <author> <slug> <outdir> [name filter]
A=$1; S=$2; OUT=$3; PAT=${4:-}
mkdir -p "$OUT"; J=$(mktemp); B="https://$A.itch.io/$S"
tok() { grep -o 'csrf_token" value="[^"]*"' "$1" | head -1 | cut -d'"' -f3; }
jurl() { python -c "import sys,json;print(json.load(sys.stdin).get('url',''))"; }
curl -s -c $J -b $J "$B" -o "$OUT/_page.html"
CSRF=$(tok "$OUT/_page.html"); [ -z "$CSRF" ] && { echo "no csrf ($S)"; exit 1; }
URL=$(curl -s -c $J -b $J -X POST "$B/download_url" -d "csrf_token=$CSRF" -H "X-Requested-With: XMLHttpRequest" | jurl | tr -d '\r')
[ -z "$URL" ] && { echo "no download url ($S) - maybe paid"; exit 1; }
curl -s -c $J -b $J "$URL" -o "$OUT/_dl.html"
CSRF=$(tok "$OUT/_dl.html")
python - "$OUT/_dl.html" > "$OUT/_uploads.txt" <<'E'
import re,sys
h=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
for m in re.finditer(r'data-upload_id="(\d+)".*?<strong title="([^"]*)" class="name"',h,re.S): print(m.group(1)+'|'+re.sub(r'[\[\]\s]+','_',m.group(2)))
E
cat "$OUT/_uploads.txt"
while IFS='|' read -r id name; do
  id=${id//$'\r'/}; name=${name//$'\r'/}
  [ -n "$PAT" ] && ! echo "$name" | grep -qi "$PAT" && continue
  D=$(curl -s -c $J -b $J -X POST "${URL%/download/*}/file/$id?source=view_game&as_props=1&after_download_lightbox=true" -d "csrf_token=$CSRF" -H "X-Requested-With: XMLHttpRequest" | jurl | tr -d '\r')
  [ -n "$D" ] && { echo "get $name"; curl -L --fail -sS --retry 3 --connect-timeout 30 "$D" -o "$OUT/$name" || echo "curl failed $?"; }
done < "$OUT/_uploads.txt"
ls -la "$OUT" | grep -v "_dl\|_page\|_uploads"
