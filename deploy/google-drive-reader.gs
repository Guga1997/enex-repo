/**
 * Google Apps Script — მომწოდებლის Drive-ის ფოლდერის CSV ფაილების გადაცემა enex.ge-ს სერვერისთვის.
 *
 * რატომ: ფოლდერი ჩვენს Google ანგარიშს მხოლოდ ნახვის უფლებით აქვს გაზიარებული — სხვას (სერვისის
 * ანგარიშს) ვერ ვუზიარებთ. სკრიპტი ამავე ანგარიშით ეშვება და ფაილს კითხულობს.
 *
 * გაშვება (script.google.com, იმ ანგარიშით, რომელსაც ფოლდერი აქვს):
 *   1. ახალი პროექტი → ეს კოდი; TOKEN-ში გრძელი შემთხვევითი სტრიქონი.
 *   2. Project Settings → „Show appsscript.json“ → oauthScopes: ["https://www.googleapis.com/auth/drive.readonly"]
 *   3. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *   4. /exec ბმული — მიმწოდებლის „მისამართში“, TOKEN — „გასაღებში“ (ადაპტერი GDRIVE_CSV).
 *
 * მხოლოდ კითხვა, მხოლოდ ამ ფოლდერის .csv ფაილები, მხოლოდ სწორი გასაღებით (მოთხოვნის ტანში).
 */
const TOKEN = 'ჩასვი-აქ-გასაღები';
const FOLDER = '1kdAtyblzisYAk03NXr_sJiMZRDMXFYBZ';

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) {}
  if (!req.token || req.token !== TOKEN) return out({ error: 'forbidden' });
  const name = String(req.file || '');
  if (!/^[A-Za-z0-9_.+-]+\.csv$/i.test(name)) return out({ error: 'bad file' });
  const it = DriveApp.getFolderById(FOLDER).getFilesByName(name);
  let best = null;
  while (it.hasNext()) { const f = it.next(); if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f; }
  if (!best) return out({ error: 'not found' });
  return out({ name: best.getName(), modified: best.getLastUpdated().toISOString(), text: best.getBlob().getDataAsString('UTF-8') });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
