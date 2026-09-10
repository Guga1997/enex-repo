# გატანა სერვერზე — enex.ge

მიზანი: `https://enex.ge`, PostgreSQL-ით, ავტომატური სერტიფიკატით.

წინაპირობა: Ubuntu 26.04 LTS, Hetzner CX33 (4 ბირთვი / 8 GB / 80 GB), ჰელსინკი.

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

# --- Node.js 22+ ---
# NodeSource ახალ LTS-ს ხანდახან აგვიანებს. ჯერ ის ვცადოთ:
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs

# თუ ზემოთა ჩავარდა (26.04-ის რეპოზიტორია ჯერ არ არის), fnm-ით:
#   curl -fsSL https://fnm.vercel.app/install | bash
#   source ~/.bashrc && fnm install 22 && fnm default 22
#   ln -sf "$(fnm exec --using=22 which node)" /usr/bin/node
#
# ან უბრალოდ სისტემური პაკეტი, თუ საკმარისად ახალია:
#   apt install -y nodejs npm

node --version   # უნდა იყოს v22 ან უფრო ახალი
npm --version

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

sudo -u enex npm ci --omit=dev
sudo -u enex npm run db:pg      # PostgreSQL-ის სქემა და მიგრაცია
sudo -u enex npm run db:deploy  # ცხრილების შექმნა
sudo -u enex npm run build:prod
```

`AUTH_SECRET`-ისთვის: `openssl rand -base64 48`

---

## 5. საწყისი მონაცემები

```bash
sudo -u enex npx tsx prisma/seed.ts            # ადმინი და დემო-კატალოგი
sudo -u enex npx tsx prisma/seed-taxonomy.ts   # სეგმენტების სამდონიანი ხე
```

**პირველივე საქმე:** შედი `/admin`-ზე და შეცვალე ადმინის პაროლი.

---

## 6. სერვისი და Nginx

```bash
sudo cp deploy/enex-shop.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now enex-shop
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

**BOG** — ბანკს მიაწოდე callback:
`https://enex.ge/api/payments/bog/callback`

⚠️ `BOG_PUBLIC_KEY`-ის გარეშე callback უარყოფილი იქნება და შეკვეთა გადახდილად **არ** მოინიშნება.
ეს განზრახაა: ხელმოწერის შემოწმების გარეშე ნებისმიერს შეუძლია ყალბი „გადახდილია" გამოგზავნოს.

**Resend** — დომენის დადასტურება (SPF/DKIM ჩანაწერები), თორემ წერილები სპამში წავა.

---

## 8. განახლება

```bash
sudo -u enex bash /var/www/enex/deploy/update.sh
```

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
tar czf "$D/uploads-$(date +%F).tar.gz" -C /var/www/enex/public uploads
find "$D" -mtime +30 -delete
```

`chmod +x` და შეამოწმე, რომ ფაილები მართლა იქმნება. **ასლი, რომელიც აღდგენაზე არ გისინჯავს,
ასლი არ არის** — ერთხელ მაინც სცადე აღდგენა ცალკე ბაზაში.

---

## რა რჩება გასაკეთებელი

- სურათებისა და datasheet-ების ჩამოტვირთვა მიმწოდებლიდან — intellcom hotlink-ს არ უშვებს
- `/api/orders`-ზე rate limiting — ბოტს შეუძლია შეკვეთების დაგენერირება
- ავტომატური ტესტები
