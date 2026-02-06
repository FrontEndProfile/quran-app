#!/bin/bash
set -euo pipefail

# ===== CONFIG =====
FTP_HOST="ftp.asmco.company"
FTP_USER="quran@quran.asmco.company"
FTP_PASS='quranzxcvbnm123$$$'

REMOTE_DIR=""
LOCAL_DIR="dist/"

# ===== HELPERS =====
require_file () {
  local file="$1"
  local label="$2"
  if [ ! -f "$LOCAL_DIR/$file" ]; then
    echo "❌ $label FAIL: '$LOCAL_DIR/$file' missing"
    exit 1
  fi
  echo "✅ $label OK: $file"
}

run_level () {
  local level="$1"
  echo ""
  echo "=============================="
  echo "🚧 LEVEL $level: Build + Prebuild"
  echo "=============================="

  echo "▶ Running: npm run build"
  npm run build

  if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ LEVEL $level FAIL: '$LOCAL_DIR' folder not found"
    exit 1
  fi

  echo "🔎 LEVEL $level: Validating required files..."
  require_file "index.html"   "LEVEL $level"
#   require_file "sitemap.xml"  "LEVEL $level"
#   require_file ".htaccess"    "LEVEL $level"

  echo "✅ LEVEL $level READY (All required files present)"
}

# ===== MAIN =====
echo "🚀 Deploy pipeline started (LOCAL)"

# Level 1
run_level "1"

# Level 2 (again same command + same checks)
# run_level "2"

echo ""
echo "📤 FTP Upload started (to staging only): $REMOTE_DIR"

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow no
set net:max-retries 2
set net:timeout 30

mkdir -p $REMOTE_DIR
mirror --reverse --delete --verbose "$LOCAL_DIR/" "$REMOTE_DIR/"
bye
EOF

echo ""
echo "✅ Upload complete (staging updated)"
echo "📌 FINAL STEP (server deploy):"
echo "   cPanel Terminal me ja kar run karo:"
echo "   bash ~/deploy-server.sh "
echo "   OR "
echo "   asmco k main domain pr add krna warna sub delete ho jaye ga sub domain ka'"

