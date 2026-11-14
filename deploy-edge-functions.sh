#!/usr/bin/env bash
# ============================================================
# دیپلوی خودکار هر ۶ Edge Function — دفتر حساب کتاب v3.۷
# ------------------------------------------------------------
# استفاده (از داخل VS Code Terminal):
#   bash deploy-edge-functions.sh
#
# پیش‌نیاز (فقط بار اول):
#   npm install -g supabase
#   supabase login
#   supabase link --project-ref <PROJECT_REF>
#
# نکته: verify_jwt همه توابع از supabase/config.toml خوانده می‌شود
# (همه false هستند — خود توابع با auth.getUser توکن را بررسی می‌کنند).
# ============================================================
set -e
cd "$(dirname "$0")"

FUNCTIONS=(
  create-transaction
  manage-transaction
  admin-users
  admin-counterparties
  telegram-bot
  backup-email
)

echo "════════════════════════════════════════════════"
echo " دیپلوی Edge Function‌های دفتر حساب کتاب (۶ تابع)"
echo "════════════════════════════════════════════════"

for fn in "${FUNCTIONS[@]}"; do
  echo ""
  echo "▶ Deploy: $fn ..."
  supabase functions deploy "$fn"
done

echo ""
echo "════════════════════════════════════════════════"
echo " ✅ همه ۶ تابع دیپلوی شدند."
echo "════════════════════════════════════════════════"
