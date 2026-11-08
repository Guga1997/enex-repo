#!/usr/bin/env bash
# სერვერის კონფიგურაცია აუდიტის შემდეგ (2026-11-08). root-ით:
#
#   bash /var/www/enex/deploy/harden.sh
#
# გამეორება უსაფრთხოა — უკვე გაკეთებულს მეორედ არ აკეთებს. nginx-ის ძველი ფაილი
# /root/-ში ინახება; `nginx -t` თუ ჩავარდა, ძველი ბრუნდება და არაფერი იცვლება.
set -euo pipefail
cd /var/www/enex
sudo -u enex git pull --ff-only -q

echo "→ 1. ბაზის ღამის ასლი (03:30, 14 დღე)"
cp deploy/enex-backup.service deploy/enex-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now enex-backup.timer >/dev/null
systemctl start enex-backup.service
ls -la /var/backups/enex | tail -2

echo "→ 2. Next მხოლოდ localhost-ზე"
sed -i 's#next start -p 3000#next start -H 127.0.0.1 -p 3000#' /etc/systemd/system/enex-shop.service
systemctl daemon-reload

echo "→ 3. nginx: /_next/image მხოლოდ ჩვენი და მიმწოდებლების ფოტოები; /uploads — სკრიპტის გარეშე"
site=/etc/nginx/sites-available/enex
bak=/root/enex-nginx.$(date +%Y%m%d-%H%M%S).bak
cp "$site" "$bak"
cp deploy/nginx-image-allow.conf /etc/nginx/conf.d/enex-image-allow.conf
if ! grep -q 'enex_image_ok' "$site"; then
  sed -i 's#^\(\s*\)location /_next/image {#&\n\1    if ($enex_image_ok = 0) { return 403; }#' "$site"
fi
if ! grep -q 'sandbox' "$site"; then
  sed -i "/location \/uploads\/ {/,/}/ s#^\(\s*\)access_log off;#&\n\1add_header Content-Security-Policy \"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox\" always;\n\1add_header X-Content-Type-Options nosniff always;#" "$site"
fi
if nginx -t 2>/dev/null; then
  systemctl reload nginx
else
  echo "✗ nginx -t ჩავარდა — ძველი ბრუნდება"
  cp "$bak" "$site"
  rm -f /etc/nginx/conf.d/enex-image-allow.conf
  nginx -t && systemctl reload nginx
  exit 1
fi

echo "→ 4. აპლიკაციის გადატვირთვა (localhost-ზე)"
systemctl restart enex-shop
sleep 4
systemctl is-active --quiet enex-shop && echo "  ✓ მუშაობს" || { journalctl -u enex-shop -n 20 --no-pager; exit 1; }
ss -ltn | grep -q '127.0.0.1:3000' && echo "  ✓ მხოლოდ 127.0.0.1:3000"

echo "→ 5. ძველი სადემონსტრაციო ადმინი (admin@example.ge) — პაროლი უქმდება"
sudo -u postgres psql -d enex -qAt -c "UPDATE \"Admin\" SET active = false, \"passwordHash\" = '!' || md5(random()::text), \"passwordChangedAt\" = now() WHERE email = 'admin@example.ge' RETURNING 'გაუქმდა: ' || email"

echo "→ 6. გარე მისამართზე დარჩენილი ფოტოები ჩვენს დისკზე"
sudo -u enex bash -c "set -a; . ./.env; set +a; npx tsx scripts/localize-media.ts" | tail -3

echo "→ შემოწმება"
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
echo "  საიტი:            $(code https://enex.ge/)"
echo "  ჩვენი ფოტო:       $(code 'https://enex.ge/_next/image?url=%2Fbrand%2Fog.png&w=64&q=75')  (200)"
echo "  უცხო საიტის ფოტო: $(code 'https://enex.ge/_next/image?url=https%3A%2F%2Fupload.wikimedia.org%2Fx.png&w=64&q=75')  (403)"
echo "✓ დასრულდა"
