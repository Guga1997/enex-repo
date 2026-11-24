/**
 * Google Drive-ის ფოლდერიდან მომავალი მიმწოდებელი (GDRIVE_CSV): CSV-ის წაკითხვა,
 * მოდელის გამოყოფა, წვდომის ტოკენი და ფაილების ჩამოტვირთვა — ქსელის გარეშე, ყალბი ტრანსპორტით.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import {
  accessToken, fetchDriveItems, folderId, parseCsv, parseDriveCsv, resetDriveAuth, splitName, type Transport,
} from "../src/lib/suppliers/gdrive";

const HEAD =
  '"შტრიხკოდი","დასახელება","კატეგორია","პროდუქციის კატეგორია","პროდუქციის ტიპი","მწარმოებელი","საცალო ფასი ლარი","საცალო ფასი აშშ დოლარი","ჯამური ნაშთი","ჯამური რეზერვი","ჯამური ხელმისაწვდომი ნაშთი","მინდელის საწყობის ნაშთი","მინდელის საწყობის რეზერვი","აეროპორტის საწყობის ნაშთი","აეროპორტის საწყობის რეზერვი"';
const CHANNEL =
  "﻿" +
  [
    HEAD,
    '"582151","IPC-HFW1439TL1-A-IL 2.8mm 4მპ Bullet კამერა პლასტ კორპუსი IP67, Mic, IR/Warm light 30მ #582151","/Channel","ვიდეო მეთვალყურეობა","IP კამერა","Dahua Technology","256.6674","99","60","0","60","40","0","20","0"',
    '"582152","IPC-HFW1439TL1-A-IL 3.6mm 4მპ Bullet კამერა, ""Smart"" IR #582152","/Channel","ვიდეო მეთვალყურეობა","IP კამერა","Dahua Technology","256.6674","99","5","5","0","5","5","0","0"',
    '"582087","ASC3202B კონტროლერი WEB-Based, 2 გამოსასვლელი #582087","/Channel","შეზღუდული დაშვების სისტემა","კონტროლერი","Dahua Technology","731.1132","282","2","0","2","2","0","0","0"',
  ].join("\r\n") +
  "\r\n";
const WISUAL = [
  HEAD,
  '"581714","HY-1301 სამისამართო კვამლის დეტექტორი, ბაზით, 24VDC #581714","/Wisualarm","სახანძრო სიგნალიზაცია","ბოლის დეტექტორი","Wisualarm","36.3742","14.03","4719","104","4615","151","104","4568","0"',
  '"581776","HY-1801 გახმოვანების სისტემის მთავარი პანელი #581776","/Wisualarm","გახმოვანების სისტემა","მიკროფონი","Wisualarm","0","0","4","0","4","4","0","0","0"',
].join("\n");
const BRANDS = { "Dahua Technology": "Dahua", Wisualarm: "Dahua" };

test("CSV: BOM, ბრჭყალებში მძიმე და ორმაგი ბრჭყალი, CRLF", () => {
  const rows = parseCsv(CHANNEL);
  assert.equal(rows.length, 4);
  assert.equal(rows[0][0], "შტრიხკოდი");
  assert.equal(rows[2][1], 'IPC-HFW1439TL1-A-IL 3.6mm 4მპ Bullet კამერა, "Smart" IR #582152');
  assert.deepEqual(parseCsv("a;b\n1;2\n")[1], ["1", "2"], "გამყოფი ; თვითონ იცნობა");
});

test("მოდელი: ობიექტივი მოდელის ნაწილია, ბოლოს მიწერილი #კოდი იშლება", () => {
  assert.deepEqual(splitName("IPC-HFW1439TL1-A-IL 2.8mm 4მპ Bullet კამერა #582151", "582151"), {
    model: "IPC-HFW1439TL1-A-IL 2.8mm",
    rest: "4მპ Bullet კამერა",
  });
  assert.equal(splitName("HAC-HFW1200RP-Z-IRE6 2.7-12mm 2მპ კამერა #58249", "58249").model, "HAC-HFW1200RP-Z-IRE6 2.7-12mm");
  assert.deepEqual(splitName("ASC3202B კონტროლერი WEB-Based #582087", "582087"), { model: "ASC3202B", rest: "კონტროლერი WEB-Based" });
});

test("პოზიცია: კოდი, სახელი საიტის სტილით, ხელმისაწვდომი ნაშთი, ფასი ლარში", () => {
  const items = parseDriveCsv(CHANNEL, "dahua_channel.csv", { brands: BRANDS });
  assert.equal(items.length, 3);
  const cam = items[0];
  assert.equal(cam.supplierSku, "582151");
  assert.equal(cam.model, "IPC-HFW1439TL1-A-IL 2.8mm");
  assert.equal(cam.brand, "Dahua");
  assert.match(cam.name, /^Dahua IPC-HFW1439TL1-A-IL 2\.8mm — 4მპ Bullet კამერა/);
  assert.ok(!cam.name.includes("#582151"));
  assert.equal(cam.cost, 256.67);
  assert.equal(cam.qty, 60);
  assert.deepEqual(cam.categoryPath, ["ვიდეო მეთვალყურეობა", "IP კამერა"]);
  // ჯამური 5, რეზერვი 5 → ხელმისაწვდომი 0: მარაგად არ ითვლება
  assert.equal(items[1].qty, 0);
  assert.equal(items[1].status, "OUT_OF_STOCK");
  assert.notEqual(items[0].model, items[1].model, "ერთი კამერა ორი ობიექტივით — ორი სხვადასხვა მოდელი");
});

test("ფასი 0 — პოზიცია ფასის გარეშე მოდის; სვეტი რომ გაქრეს — შეცდომა და არა ცარიელი სია", () => {
  const items = parseDriveCsv(WISUAL, "dahua_wisualarm.csv", { brands: BRANDS });
  assert.equal(items[0].cost, 36.37);
  assert.equal(items[1].cost, null);
  assert.equal(items[1].qty, 4);
  assert.throws(() => parseDriveCsv(WISUAL.replace("საცალო ფასი ლარი", "ფასი"), "x.csv"), /სვეტი/);
  assert.throws(() => parseDriveCsv(HEAD + "\n", "x.csv"), /ერთი პოზიციაც/);
  // სვეტების რიგი რომ შეიცვალოს, სათაურით მაინც პოულობს
  const swapped = parseCsv(WISUAL)
    .map((r) => [r[6], ...r.slice(0, 6), ...r.slice(7)].map((c) => `"${c}"`).join(","))
    .join("\n");
  assert.equal(parseDriveCsv(swapped, "x.csv")[0].cost, 36.37);
});

test("ფასდაკლება: ფაილის პროცენტი; „კაბელი“ სახელში — თავისი; მათი საცალო ცალკე რჩება", () => {
  const rules = [{ word: "კაბელ", discount: 5 }];
  const cam = parseDriveCsv(CHANNEL, "dahua_channel.csv", { discount: 30, rules })[0];
  assert.equal(cam.listPrice, 256.67, "მათი საცალო");
  assert.equal(cam.cost, 179.67, "ჩვენი ფასი: საცალოს 70%");
  const fire = parseDriveCsv(WISUAL, "dahua_wisualarm.csv", { discount: 35, rules });
  assert.equal(fire[0].cost, 23.64);
  assert.equal(fire[1].cost, null, "ფასის გარეშე პოზიციას ფასდაკლება არაფერს უმატებს");
  assert.equal(fire[1].listPrice, null);

  const extra = [
    WISUAL,
    '"1","PFM920I-5EUN UTP კაბელი Cat5e, 305მ #1","/Channel","ვიდეო მეთვალყურეობა","კაბელი","Dahua Technology","200","77","3","0","3","3","0","0","0"',
    '"2","HY-JX20 საკაბელო გამანაწილებელი კოლოფი #2","/Wisualarm","სახანძრო სიგნალიზაცია","აქსესუარები","Wisualarm","100","38","3","0","3","3","0","0","0"',
  ].join("\n");
  const more = parseDriveCsv(extra, "dahua_wisualarm.csv", { discount: 35, rules });
  assert.equal(more[2].cost, 190, "კაბელი — 5%");
  assert.equal(more[3].cost, 65, "„საკაბელო“ კოლოფი კაბელი არ არის — ფაილის 35%");
});

test("ფოტოები მოდელით: ობიექტივიანი მოდელი ძირითადი მოდელის ფოტოს იღებს", () => {
  const photos = {
    "IPC-HFW1439TL1-A-IL": ["https://example.com/a.webp"],
    ASC3202B: ["https://example.com/b.webp", "https://example.com/c.webp"],
  };
  const items = parseDriveCsv(CHANNEL, "dahua_channel.csv", { photos });
  assert.deepEqual(items[0].images, ["https://example.com/a.webp"]);
  assert.deepEqual(items[1].images, ["https://example.com/a.webp"], "3.6mm ვარიანტი — იგივე ფოტო");
  assert.equal(items[2].images?.length, 2);
  assert.equal(parseDriveCsv(WISUAL, "x.csv", { photos })[0].images, undefined);
});

test("კატეგორიის წესები: პირველი დამთხვეული; ფაილი, მათი ტიპი და სიტყვა სახელში", () => {
  const categories = [
    { file: "dahua_wisualarm.csv", word: "გახმოვანებ", path: ["უსაფრთხოება", "გახმოვანება"] },
    { file: "dahua_wisualarm.csv", path: ["უსაფრთხოება", "სახანძრო"] },
    { type: "IP კამერა", path: ["უსაფრთხოება", "IP კამერები"] },
  ];
  const fire = parseDriveCsv(WISUAL, "dahua_wisualarm.csv", { categories });
  assert.deepEqual(fire[0].categoryPath, ["უსაფრთხოება", "სახანძრო"]);
  assert.deepEqual(fire[1].categoryPath, ["უსაფრთხოება", "გახმოვანება"], "სიტყვიანი წესი ზოგადზე წინ");
  const ch = parseDriveCsv(CHANNEL, "dahua_channel.csv", { categories });
  assert.deepEqual(ch[0].categoryPath, ["უსაფრთხოება", "IP კამერები"]);
  assert.deepEqual(ch[2].categoryPath, ["შეზღუდული დაშვების სისტემა", "კონტროლერი"], "წესის გარეშე — მათი კატეგორია და ტიპი");
});

test("ფოლდერის id ბმულიდან", () => {
  assert.equal(folderId("https://drive.google.com/drive/folders/1kdAtyblzisYAk03NXr_sJiMZRDMXFYBZ?usp=sharing"), "1kdAtyblzisYAk03NXr_sJiMZRDMXFYBZ");
  assert.equal(folderId("1kdAtyblzisYAk03NXr_sJiMZRDMXFYBZ"), "1kdAtyblzisYAk03NXr_sJiMZRDMXFYBZ");
  assert.throws(() => folderId("https://example.com/x"));
});

test("სერვისის ანგარიში: ხელმოწერილი მოთხოვნა, მხოლოდ კითხვის უფლება; ფაილები სახელით, უახლესი ასლი", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const email = "sync@test.iam.gserviceaccount.com";
  const calls: string[] = [];
  const ok = (body: string) => ({ ok: true, status: 200, text: async () => body });
  const http: Transport = async (url, init) => {
    calls.push(url.split("?")[0]);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const assertion = new URLSearchParams(init?.body).get("assertion")!;
      const [h, c, sig] = assertion.split(".");
      assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, sig, "base64url"), "ხელმოწერა სწორია");
      const claim = JSON.parse(Buffer.from(c, "base64url").toString());
      assert.equal(claim.iss, email);
      assert.equal(claim.scope, "https://www.googleapis.com/auth/drive.readonly");
      return ok(JSON.stringify({ access_token: "tok-1", expires_in: 3600 }));
    }
    assert.equal(init?.headers?.Authorization, "Bearer tok-1");
    if (url.includes("?q=")) {
      assert.ok(decodeURIComponent(url).includes("FOLDER1234567"));
      return ok(
        JSON.stringify({
          files: [
            { id: "old", name: "dahua_channel.csv", modifiedTime: "2026-11-01T10:00:00Z" },
            { id: "ch", name: "dahua_channel.csv", modifiedTime: "2026-11-24T13:14:00Z" },
            { id: "wi", name: "Dahua_Wisualarm.csv", modifiedTime: "2026-11-24T13:49:00Z" },
            { id: "air", name: "dahua_airshield.csv", modifiedTime: "2026-11-24T12:29:00Z" },
          ],
        })
      );
    }
    if (url.includes("/files/ch?")) return ok(CHANNEL);
    if (url.includes("/files/wi?")) return ok(WISUAL);
    throw new Error("მოულოდნელი მოთხოვნა: " + url);
  };

  resetDriveAuth();
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: email, private_key: pem });
  delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const cfg = {
    slug: "dahua-drive",
    name: "Dahua (Drive)",
    baseUrl: "https://drive.google.com/drive/folders/FOLDER1234567",
    authType: "NONE",
    secret: null,
    authHeader: null,
    fieldMap: JSON.stringify({ files: ["dahua_channel.csv", "dahua_wisualarm.csv"], brands: BRANDS }),
  };
  try {
    const items = await fetchDriveItems(cfg, http);
    assert.equal(items.length, 5, "airshield არ ითხოვება — მხოლოდ ჩამოთვლილი ფაილები");
    assert.ok(!calls.some((c) => c.endsWith("/old")), "ძველი ასლი არ იკითხება");
    // ტოკენი ქეშშია — მეორე სინქი Google-ს თავიდან არ ეკითხება
    await fetchDriveItems(cfg, http);
    assert.equal(calls.filter((c) => c.includes("oauth2")).length, 1);
    assert.equal(await accessToken({ client_email: email, private_key: pem }, http), "tok-1");

    // ფაილი გაქრა — შეცდომა (ნაწილობრივი სია ნაშთებს გაანულებდა)
    await assert.rejects(() => fetchDriveItems({ ...cfg, fieldMap: JSON.stringify({ files: ["sxva.csv"] }) }, http), /ვერ ვიპოვე/);
  } finally {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    resetDriveAuth();
  }
  // წვდომის გარეშე — გასაგები შეცდომა
  await assert.rejects(() => fetchDriveItems(cfg, http), /წვდომა გამართული არ არის/);
});
