/**
 * ქართული ძებნა ინგლისურ დასახელებებში.
 *
 * კატალოგის დიდი ნაწილი მიმწოდებლისგან ინგლისური სახელით მოდის
 * („Dell Pro 14 PC14250…“), მყიდველი კი ქართულად წერს — „ლეპტოპი“ ნულ შედეგს
 * აბრუნებდა. აქ ერთმანეთის სინონიმებია შეკრებილი: რომელ სიტყვასაც დაწერს,
 * ძებნა ჯგუფის ყველა ვარიანტს ეძებს.
 *
 * ქართული ფორმა ფუძით ეწერება („ლეპტოპ“), რომ ბრუნვებიც დაიჭიროს —
 * „ლეპტოპს“, „ლეპტოპები“, „ლეპტოპით“.
 */

const GROUPS: string[][] = [
  ["ლეპტოპ", "ნოუთბუქ", "laptop", "notebook"],
  ["კომპიუტერ", "desktop", "computer"],
  ["მონობლოკ", "all in one", "all-in-one"],
  ["ტაბლეტ", "tablet"],
  ["მონიტორ", "ეკრან", "monitor", "display"],
  ["კლავიატურ", "keyboard"],
  ["მაუს", "mouse"],
  ["ყურსასმენ", "ნაუშნიკ", "headset", "headphone", "earbud"],
  ["დინამიკ", "სპიკერ", "speaker"],
  ["მიკროფონ", "microphone"],
  ["ვებკამერ", "webcam"],
  ["კამერ", "camera"],
  ["დოკ-სადგურ", "დოკსადგურ", "docking", "dock"],
  ["ჩანთ", "ზურგჩანთ", "bag", "backpack"],
  ["პროექტორ", "projector"],
  ["პრინტერ", "printer"],
  ["სკანერ", "scanner"],
  ["სერვერ", "server"],
  ["მეხსიერებ", "ოპერატიულ", "memory", "ddr", "ram"],
  ["პროცესორ", "processor", "cpu"],
  ["ვიდეობარათ", "graphics", "gpu"],
  ["დედადაფ", "motherboard"],
  ["დისკ", "ssd", "hdd", "nvme"],
  ["ფლეშ", "flash", "usb drive"],
  ["ქულერ", "cooler", "cooling"],
  ["კვების ბლოკ", "power supply", "psu"],
  ["ადაპტერ", "adapter"],
  ["კაბელ", "cable"],
  ["როუტერ", "router"],
  ["სვიჩ", "switch"],
  ["ჰაბ", "hub"],
  ["ანტენ", "antenna"],
  ["ტელეფონ", "phone"],
  ["გენერატორ", "generator"],
  ["ინვერტორ", "inverter"],
  ["აკუმულატორ", "ბატარე", "battery"],
  ["კონდიციონერ", "air conditioner"],
  ["სიგნალიზაცი", "alarm"],
  ["დეტექტორ", "სენსორ", "detector", "sensor"],
  ["სირენ", "siren"],
  ["ხანძრ", "სახანძრ", "ხანძარსაწინააღმდეგ", "fire"],
  ["ანტივირუს", "antivirus", "security"],
  ["ლიცენზი", "license"],
  ["სეიფ", "safe"],
  ["საკეტ", "lock"],
];

const MIN = 3;

/**
 * ეძებს თუ არა სიტყვა ამ ვარიანტს — ფუძეც და სრული სიტყვაც გამოდგება.
 * „ლეპტოპებს“ ↔ „ლეპტოპ“, „laptop“ ↔ „laptops“.
 */
const touches = (word: string, variant: string) =>
  word.length >= MIN && variant.length >= MIN && (word.startsWith(variant) || variant.startsWith(word));

/**
 * სიტყვის სინონიმები — ჯგუფის ფუძის ჩათვლით.
 *
 * ფუძე აუცილებლად უნდა დაემატოს: „ყურსასმენი“ ვერ პოულობს კატეგორიას
 * „ყურსასმენები“, „ყურსასმენ“ კი ორივეს პოულობს.
 */
export function synonyms(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set<string>();
  for (const group of GROUPS) {
    if (!group.some((v) => touches(w, v))) continue;
    for (const v of group) if (v !== w) out.add(v);
  }
  return [...out];
}

/**
 * მოთხოვნა სიტყვებად — თითოეული ცალკე უნდა დაემთხვეს („dell ლეპტოპი“ ორივეს
 * ეძებს). ერთ სიტყვაზე სინონიმებიც ემატება.
 */
export function searchTerms(q: string): { word: string; variants: string[] }[] {
  return q
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 6)
    .map((word) => ({ word, variants: [word, ...synonyms(word)] }));
}
