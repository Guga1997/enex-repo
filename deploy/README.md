# გატანა სერვერზე — enex.ge

მიზანი: `https://enex.ge`, PostgreSQL-ით, ავტომატური სერტიფიკატით.

წინაპირობა: Ubuntu 24.04 LTS, Hetzner CX33 (4 ბირთვი / 8 GB / 80 GB), ჰელსინკი.

---

## 1. DNS — domenebi.ge

`enex.ge`-ს პანელში:

| ტიპი | სახელი | მნიშვნელობა |
|---|---|---|
| A | `@` | სერვერის IP |
| A | `www` | სერვერის IP |

გავრცელებას საათამდე სჭირდება. შემოწმება: `dig +short enex.ge`

---

## 2. სერვერის საბაზისო მომზადება

```bash
adduser enex
usermod -aG sudo enex

apt update && apt upgrade -y
apt install -y curl git nginx postgresql certbot python3-certbot-nginx ufw

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

node --version   # v22.x

ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

**SSH გამაგრება** — პაროლით შესვლა გამორთე, სანამ საიტი გარეთ გავა:
`/etc/ssh/sshd_config` → `PasswordAuthentication no`, `PermitRootLogin no`, შემდეგ `systemctl restart ssh`.
წინასწარ დარწმუნდი, რომ გასაღებით შესვლა მუშაობს — თორემ საკუთარ სერვერზე ვეღარ შეხვალ.

---

## 3. ბაზა

```bash
sudo -u postgres psql
```

```sql
CREATE USER enex WITH PASSWORD 'ᲨᲔᲪᲕᲐᲚᲔ';
CREATE DATABASE enex OWNER enex;
\q
```

PostgreSQL ნაგულისხმევად მხოლოდ `localhost`-ს უსმენს — ეს სწორი მდგომარეობაა, გარედან წვდომა არ გვჭირდება.

---

## 4. კოდი

```bash
sudo mkdir -p /var/www/enex && sudo chown enex:enex /var/www/enex
sudo -u enex git clone <რეპოზიტორია> /var/www/enex
cd /var/www/enex

sudo -u enex cp deploy/env.production.example .env
sudo -u enex nano .env          # შეავსე ყველა ველი
sudo chmod 600 .env

sudo -u enex npm ci   # devDependencies საჭიროა ბილდისთვის
sudo -u enex npm run db:pg      # PostgreSQL-ის სქემა და მიგრაცია
sudo -u enex npm run db:deploy  # ცხრილების შექმნა
sudo -u enex npm run build:prod
```

`AUTH_SECRET`-ისთვის: `openssl rand -base64 48`

---

## 5. საწყისი მონაცემები

```bash
sudo -u enex npx tsx prisma/seed.ts            # მხოლოდ ადმინი და ხე — დემო-პროდუქტები სერვერზე არ იქმნება
sudo -u enex npx tsx prisma/seed-taxonomy.ts   # სეგმენტების სამდონიანი ხე
```

**პირველივე საქმე:** შედი `/admin`-ზე და შეცვალე ადმინის პაროლი.

---

## 6. სერვისი და Nginx

```bash
sudo cp deploy/enex-shop.service deploy/enex-release.* deploy/enex-sync.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now enex-shop
sudo systemctl enable --now enex-release.timer   # ვადაგასული რეზერვაციები, წუთში ერთხელ
sudo systemctl enable --now enex-sync.timer      # მიმწოდებლების სინქი — ინტერვალი ადმინშია
sudo systemctl status enex-shop

sudo cp deploy/nginx-enex.conf /etc/nginx/sites-available/enex
sudo ln -s /etc/nginx/sites-available/enex /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d enex.ge -d www.enex.ge
```

certbot განახლებას თვითონ გეგმავს. შემოწმება: `sudo certbot renew --dry-run`

---

## 7. გარე სერვისები

**intellcom** — კაბინეტში „დაშვებული IP მისამართები"-ში **სერვერის IP** ჩაწერე, არა სახლის.
შემდეგ `/admin/suppliers` → Intellcom → „შემოწმება".

**BOG** — `.env`-ში `BOG_CLIENT_ID` / `BOG_CLIENT_SECRET` (ბანკის წერილში „OPAY CLIENT ID / SECRET KEY“),
`PAYMENT_MOCK=0`, გადატვირთვა. callback-ის მისამართი ყოველ შეკვეთაზე თვითონ იგზავნება
(`https://enex.ge/api/payments/bog/callback`), ბანკში ცალკე რეგისტრაცია არ სჭირდება.
ხელმოწერა ბანკის საჯარო გასაღებით მოწმდება (კოდშია); ხელმოუწერელი callback უარიყოფა.
სატესტო რეჟიმში ბანკი 100 ₾-ის ლიმიტს აძლევს — რეალური გაყიდვებისთვის იმავე მეილზე უნდა მოეთხოვოს მოხსნა.

**ელფოსტა** — Hetzner Webhosting S (`konsoleh.hetzner.com`), ყუთი `noreply@enex.ge`, SMTP
`mail.your-server.de:587`. MX/SPF/DKIM Hetzner Cloud DNS-შია. ლიმიტი 500/საათი; ნიუსლეთერი
აქედან აკრძალულია. შემოწმება სერვერზე (sudo-ს გარეშე — ის გარემოს ყრის):
`set -a && . /var/www/enex/.env && set +a && npx tsx scripts/test-email.ts შენი@ელფოსტა`

**SMS** — uBill (`my.ubill.ge`): Brand `Enex` → `SMS_BRAND_ID`, API გასაღები → `SMS_API_KEY`,
`SMS_PROVIDER=ubill`. შემოწმება: `npx tsx scripts/test-sms.ts 5XXXXXXXX`

**გაყიდვების შეტყობინებები** — `SALES_EMAIL` (რამდენიმე მძიმით). ყოველ ახალ შეკვეთაზე წერილი
შეკვეთის ფურცლით (გადარიცხვაზე — ინვოისი ბანკის რეკვიზიტებით; POS/ბარათზე — გადახდის მეთოდით)
და ცალკე წერილი გადახდის დადასტურებაზე. `SALES_PHONE` — არასავალდებულო SMS ახალ შეკვეთაზე.

**Excel მიმწოდებელი (SPREADSHEET)** — API-ს გარეშე: `/admin/suppliers` → ადაპტერი SPREADSHEET → fieldMap-ში
ფურცლების აღწერა → Excel-ის ატვირთვა (ინახება `data/pricelists/<slug>.xlsx`, public-ის გარეთ) → სინქი
ატვირთვისთანავე. ახალი ნუსხა — იგივე ფორმა, ახალი ფაილი. `data/` სარეზერვო ასლში ჩართე.

**ვალუტა** — ევროში/დოლარში მოცემული ნუსხები (`"currency": "EUR"` ფურცელზე) ლარში ეროვნული ბანკის
კურსით ითვლება; კურსი დღეში ერთხელ იტვირთება `data/fx.json`-ში. გენერატორების სინქი საათში ერთხელაა —
კურსის ცვლილება ფასებში ავტომატურად აისახება. datasheet-ები `public/uploads/docs/<docsDir>/`-ში,
ფაილის სახელი მოდელით იწყება (zen-72-tbi_en.pdf → ZEN 72 TBI).

**Bluetti კონფიგურატორი** — `public/tools/bluetti.html`, მისამართი `/bluetti` (rewrite next.config-ში).
ფასი და ნაშთი კატალოგიდან მოაქვს (`/api/catalog/prices`) — HTML-ში ჩაშენებული ციფრები მხოლოდ სათადარიგოა.

**ავტომატური სინქი** — `/admin/suppliers` → რედაქტირება → „ავტომატური სინქი — ყოველ რამდენ წუთში“.
`enex-sync.timer` წუთში ერთხელ ამოწმებს, ვის მოუვიდა დრო. ლოგი: `journalctl -u enex-sync -n 50`

---

## 8. განახლება

```bash
sudo -u enex bash /var/www/enex/deploy/update.sh
```

სკრიპტს `enex`-ის სახელით ორი sudo-ბრძანება სჭირდება პაროლის გარეშე — `/etc/sudoers.d/enex-deploy`:

```
enex ALL=(root) NOPASSWD: /usr/bin/systemctl restart enex-shop, /usr/bin/systemctl stop enex-sync.timer enex-release.timer, /usr/bin/systemctl start enex-sync.timer enex-release.timer
```

ტაიმერები განახლების დროს ჩერდება — თორემ `npm ci`-ს ფანჯარაში გაშვებული სინქი ჩავარდება.

სკრიპტი წამოიღებს კოდს, გაუშვებს მიგრაციას, ააწყობს და გადატვირთავს. ბოლოს ამოწმებს,
რომ სერვისი მართლა ადგა — თუ არა, ლოგს აჩვენებს და შეცდომით სრულდება.

---

## 9. სარეზერვო ასლი

ბაზა და ატვირთული ფაილები — ორივე საჭიროა, კოდი git-შია.

```bash
# /etc/cron.daily/enex-backup
#!/bin/sh
set -e
D=/var/backups/enex
mkdir -p "$D"
sudo -u postgres pg_dump enex | gzip > "$D/db-$(date +%F).sql.gz"
tar czf "$D/uploads-$(date +%F).tar.gz" -C /var/www/enex public/uploads data
find "$D" -mtime +30 -delete
```

`chmod +x` და შეამოწმე, რომ ფაილები მართლა იქმნება. **ასლი, რომელიც აღდგენაზე არ გისინჯავს,
ასლი არ არის** — ერთხელ მაინც სცადე აღდგენა ცალკე ბაზაში.

---

## რა რჩება გასაკეთებელი

- datasheet-ების ლოკალურად ჩამოტვირთვა (სურათები უკვე ლოკალურია): `npx tsx scripts/localize-media.ts --docs`
- ავტომატური ტესტები
