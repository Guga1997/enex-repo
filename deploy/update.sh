#!/usr/bin/env bash
# განახლება სერვერზე: sudo -u enex bash /var/www/enex/deploy/update.sh
set -euo pipefail

cd /var/www/enex

# ტაიმერები ჩერდება: npm ci node_modules-ს შლის და prisma-ს კლიენტს sqlite-ის სქემით
# აწყობს — ამ ფანჯარაში გაშვებული სინქი „URL must start with file:“-ით ჩავარდებოდა.
TIMERS="enex-sync.timer enex-release.timer"
echo "→ ტაიმერების პაუზა"
sudo systemctl stop $TIMERS
trap 'sudo systemctl start $TIMERS' EXIT

echo "→ კოდის წამოღება"
git pull --ff-only

echo "→ დამოკიდებულებები"
# next build-ს typescript და tailwind სჭირდება — ისინი devDependencies-შია.
# --include=dev ცალსახად, რადგან NODE_ENV=production-ზე npm მათ თავისით ტოვებს.
npm ci --include=dev

# schema.postgres.prisma გენერირებულია და git-ში არ არის — ყოველ ჯერზე თავიდან,
# თორემ კლიენტი ძველი სქემიდან აიწყობა და ახალი ველები არ ეცოდინება.
echo "→ PostgreSQL სქემა"
npm run db:pg

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
