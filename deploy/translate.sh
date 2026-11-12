#!/usr/bin/env bash
# პროდუქტებისა და კატეგორიების ინგლისური/რუსული სახელების შევსება ლექსიკონიდან
# (data/phrases-i18n.json, data/category-i18n.json). მხოლოდ ცარიელ ველებს ავსებს —
# არსებულ თარგმანს, ფასს და მარაგს არ ეხება; ხელახლა გაშვება უსაფრთხოა.
#
#   ssh root@სერვერი 'sudo -u enex bash /var/www/enex/deploy/translate.sh'
set -euo pipefail
cd /var/www/enex
set -a; . ./.env; set +a
npx tsx scripts/translate-catalog.ts
