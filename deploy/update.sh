#!/usr/bin/env bash
# განახლება სერვერზე: sudo -u enex bash /var/www/enex/deploy/update.sh
set -euo pipefail

cd /var/www/enex

echo "→ კოდის წამოღება"
git pull --ff-only

echo "→ დამოკიდებულებები"
npm ci --omit=dev

echo "→ ბაზის მიგრაცია"
npm run db:deploy

# ყურადღება: npm run build sqlite-ის სქემით გაუშვებდა prisma generate-ს
# და პროდაქშენის კლიენტს გადააწერდა. build:prod სწორ სქემას იყენებს.
echo "→ ბილდი"
npm run build:prod

echo "→ გადატვირთვა"
sudo systemctl restart enex-shop

sleep 3
systemctl is-active --quiet enex-shop && echo "✓ მუშაობს" || { echo "✗ ვერ აეშვა"; journalctl -u enex-shop -n 30 --no-pager; exit 1; }
