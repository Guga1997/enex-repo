/**
 * ალტას B2B ნუსხა → ჩვენი კატალოგი: კატეგორიის გზა და წასაკითხი სახელი.
 *
 * B2B-ის `category` ინგლისური იარლიყია („Smartphone“, „Built-in Hob“), `item_full_name` კი მათი შიდა
 * ხის გზაა („Mobile and Smartphones/ Apple/ Apple iPhone 16 128GB White E-sim/TP“). აქ ორივე ჩვენს
 * სახეზე გადადის. სეგმენტები alta.ge-ის მენიუს მიჰყვება; მფლობელმა (2026-11-27) აირჩია: მობილურები და
 * აქსესუარები, კომპიუტერული ტექნიკა, ტელევიზორები (მხოლოდ), გეიმინგი, მსხვილი და წვრილი საყოფაცხოვრებო
 * ტექნიკა. სხვა კატეგორიები (ჭკვიანი სახლი, ყურსასმენები, ფოტო, მტვერსასრუტები, თავის მოვლა…) აქ არ არის —
 * ისინი საიმპორტო კალათაში რჩება, სანამ მფლობელი არ მოითხოვს.
 */

export type AltaSegment = "mobile" | "computers" | "tv" | "gaming" | "large" | "small";
export type AltaCategory = {
  segment: AltaSegment;
  /** ჩვენი კატეგორიის გზა ძირიდან (nameKa) */
  path: string[];
  /** ტიპის სახელი მხოლობითში — სახელს ემატება, როცა B2B-ის სახელი მხოლოდ მოდელია */
  type?: { ka: string; en: string };
};

const MOBILE = "მობილურები";
const IT = "კომპიუტერული ტექნიკა";
const PCS = [IT, "კომპიუტერები და ლეპტოპები"];
const PERIPH = [IT, "პერიფერია"];
const PARTS = "კომპიუტერის კომპონენტები";
const STORAGE = "მონაცემთა შენახვა";
const LAN = "LAN & WAN";
const AV = "აუდიო-ვიდეო";
const GAMING = "გეიმინგი";
export const ALTA_LARGE = ["საყოფაცხოვრებო ტექნიკა", "მსხვილი ტექნიკა"];
export const ALTA_SMALL = ["საყოფაცხოვრებო ტექნიკა", "წვრილი ტექნიკა"];
const CLIMATE = "კლიმატური სისტემები";

const c = (segment: AltaSegment, path: string[], ka?: string, en?: string): AltaCategory => ({
  segment,
  path,
  ...(ka && en ? { type: { ka, en } } : {}),
});

export const ALTA_CATEGORIES: Record<string, AltaCategory> = {
  // მობილური ტელეფონები და აქსესუარები
  "Smartphone": c("mobile", [MOBILE, "სმარტფონები"]),
  "Smart Watch": c("mobile", [MOBILE, "სმარტ საათები"]),
  "Fitness Tracker": c("mobile", [MOBILE, "სმარტ საათები"]),
  "Accessories / Smart watch": c("mobile", [MOBILE, "სმარტ საათის აქსესუარები"]),
  "Mobile Phone Case": c("mobile", [MOBILE, "ქეისები და ეკრანის დამცავები"]),
  "Screen Protector / Glass": c("mobile", [MOBILE, "ქეისები და ეკრანის დამცავები"]),
  "Wall Charger": c("mobile", [MOBILE, "დამტენები და კაბელები"]),
  "Wireless Charger": c("mobile", [MOBILE, "დამტენები და კაბელები"]),
  "Car charger": c("mobile", [MOBILE, "დამტენები და კაბელები"]),
  "Charging Cable": c("mobile", [MOBILE, "დამტენები და კაბელები"]),
  "USB Cable": c("mobile", [MOBILE, "დამტენები და კაბელები"]),
  "Power Bank": c("mobile", [MOBILE, "პორტატული დამტენები (Power Bank)"]),
  "Wireless Speaker": c("mobile", [MOBILE, "პორტატული დინამიკები"]),
  "Accessories / Mobile": c("mobile", [MOBILE, "მობილურის აქსესუარები"]),
  "Mobile Other": c("mobile", [MOBILE, "მობილურის აქსესუარები"]),
  "Selfie Stick": c("mobile", [MOBILE, "მობილურის აქსესუარები"]),
  "FM Transmitter": c("mobile", [MOBILE, "მობილურის აქსესუარები"]),
  "Flash Card": c("mobile", [STORAGE, "SD ბარათები"]),

  // კომპიუტერული ტექნიკა და აქსესუარები
  "Notebook": c("computers", [...PCS, "ლეპტოპები"]),
  "Notebook Bag": c("computers", [...PCS, "ჩანთები და ზურგჩანთები"]),
  "Power Supply / Notebook": c("computers", [...PCS, "ლეპტოპის აქსესუარები"]),
  "Cooling Stand": c("computers", [...PCS, "ლეპტოპის აქსესუარები"]),
  "NB Accesories": c("computers", [...PCS, "ლეპტოპის აქსესუარები"]),
  "Tab": c("computers", [...PCS, "ტაბლეტები"]),
  "Accessories / Tab": c("computers", [...PCS, "ტაბლეტის აქსესუარები"]),
  "PC All-in-One": c("computers", [...PCS, "მონობლოკები (All-in-One)"]),
  "PC": c("computers", [...PCS, "დესკტოპ კომპიუტერები"]),
  "Monitor": c("computers", [AV, "მონიტორები"]),
  "Motherboard": c("computers", [PARTS, "დედადაფები"]),
  "CPU": c("computers", [PARTS, "პროცესორები"]),
  "Memory": c("computers", [PARTS, "ოპერატიული მეხსიერება"]),
  "Case / PC": c("computers", [PARTS, "ქეისები"]),
  "Power Supply / PC": c("computers", [PARTS, "კვების ბლოკები"]),
  "Cooler": c("computers", [PARTS, "ქულერები"]),
  "HDD / Internal": c("computers", [PARTS, "დისკები (კომპიუტერისთვის)"]),
  "HDD / External": c("computers", [STORAGE, "გარე დისკები"]),
  "Flash Drive": c("computers", [STORAGE, "USB მეხსიერება"]),
  "Printer": c("computers", [...PERIPH, "პრინტერები და MFP"]),
  "Copier": c("computers", [...PERIPH, "პრინტერები და MFP"]),
  "Scanner": c("computers", [...PERIPH, "სკანერები"]),
  "Cartridge": c("computers", [...PERIPH, "კარტრიჯები და ტონერები"]),
  "Toner": c("computers", [...PERIPH, "კარტრიჯები და ტონერები"]),
  "Mouse": c("computers", [...PERIPH, "კლავიატურა და მაუსი"]),
  "Mouse Pad": c("computers", [...PERIPH, "კლავიატურა და მაუსი"]),
  "Keyboard": c("computers", [...PERIPH, "კლავიატურა და მაუსი"]),
  "Web camera": c("computers", [...PERIPH, "ვებკამერები"]),
  "Speaker": c("computers", [...PERIPH, "პერიფერიის აქსესუარები"]),
  "Microphone": c("computers", [...PERIPH, "პერიფერიის აქსესუარები"]),
  "Accessories / IT": c("computers", [...PERIPH, "პერიფერიის აქსესუარები"]),
  "Adapter": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "Hub": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "USB Hub": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "HDMI Cable": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "DVI Cable": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "AUX Cable": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "Cable": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "Power Cable": c("computers", [...PERIPH, "კაბელები და ადაპტერები"]),
  "Router": c("computers", [LAN, "როუტერები და Firewall-ები", "WiFi როუტერები"]),
  "Switch": c("computers", [LAN, "სვიჩები (LAN)", "არამართვადი PoE სვიჩები (LAN)"]),
  "Patch cord": c("computers", [LAN, "LAN კომპონენტები", "პაჩკორდები"]),
  "UPS": c("computers", ["ენერგო უზრუნველყოფა", "უწყვეტი კვების წყაროები UPS", "Line Interactive UPS"]),

  // ტელევიზორები (მხოლოდ ტელევიზორი — საკიდები, პროექტორები და აუდიო არა)
  "TV": c("tv", [AV, "ტელევიზორები"], "ტელევიზორი", "TV"),

  // გეიმინგი
  "Game Console": c("gaming", [GAMING, "სათამაშო კონსოლები"]),
  "Accessories / Game Console": c("gaming", [GAMING, "კონსოლის აქსესუარები და თამაშები"]),
  "Joystick": c("gaming", [GAMING, "კონსოლის აქსესუარები და თამაშები"]),

  // მსხვილი საყოფაცხოვრებო ტექნიკა
  "Refrigerator": c("large", [...ALTA_LARGE, "მაცივრები"], "მაცივარი", "Refrigerator"),
  "Built-in Refrigerator": c("large", [...ALTA_LARGE, "მაცივრები"], "ჩასაშენებელი მაცივარი", "Built-in Refrigerator"),
  "Washing Machine": c("large", [...ALTA_LARGE, "სარეცხი მანქანები"], "სარეცხი მანქანა", "Washing Machine"),
  "Dryer": c("large", [...ALTA_LARGE, "საშრობი მანქანები"], "საშრობი მანქანა", "Dryer"),
  "Dishwasher": c("large", [...ALTA_LARGE, "ჭურჭლის სარეცხი მანქანები"], "ჭურჭლის სარეცხი მანქანა", "Dishwasher"),
  "Built-in Dishwasher": c("large", [...ALTA_LARGE, "ჭურჭლის სარეცხი მანქანები"], "ჩასაშენებელი ჭურჭლის სარეცხი მანქანა", "Built-in Dishwasher"),
  "Gas Cooker": c("large", [...ALTA_LARGE, "გაზქურები"], "გაზქურა", "Cooker"),
  "Built-in Hob": c("large", [...ALTA_LARGE, "ჩასაშენებელი ქურები"], "ჩასაშენებელი ქურა", "Built-in Hob"),
  "Built-in Oven": c("large", [...ALTA_LARGE, "ჩასაშენებელი ღუმელები"], "ჩასაშენებელი ღუმელი", "Built-in Oven"),
  "Built-in Microwave": c("large", [...ALTA_LARGE, "ჩასაშენებელი ღუმელები"], "ჩასაშენებელი მიკროტალღური ღუმელი", "Built-in Microwave"),
  "Built-in Hood": c("large", [...ALTA_LARGE, "გამწოვები"], "გამწოვი", "Hood"),
  "Air Conditioning": c("large", [CLIMATE, "საყოფაცხოვრებო კონდიციონერები"], "კონდიციონერი", "Air Conditioner"),
  "Gas Heater": c("large", [CLIMATE, "გამათბობლები"], "გაზის გამათბობელი", "Gas Heater"),
  "Heater": c("large", [CLIMATE, "გამათბობლები"], "გამათბობელი", "Heater"),
  "Fan": c("large", [CLIMATE, "გამათბობლები"], "ვენტილატორი", "Fan"),

  // წვრილი საოჯახო ტექნიკა
  "Coffee Maker": c("small", [...ALTA_SMALL, "ყავის აპარატები"], "ყავის აპარატი", "Coffee Maker"),
  "Coffee Press": c("small", [...ALTA_SMALL, "ყავის აპარატები"], "ყავის მადუღარა", "Coffee Press"),
  "Coffee Grinder": c("small", [...ALTA_SMALL, "ყავის აპარატები"], "ყავის საფქვავი", "Coffee Grinder"),
  "Milk Frother": c("small", [...ALTA_SMALL, "ყავის აპარატები"], "რძის ამქაფებელი", "Milk Frother"),
  "Blender": c("small", [...ALTA_SMALL, "ბლენდერები და ჩოპერები"], "ბლენდერი", "Blender"),
  "Chopper": c("small", [...ALTA_SMALL, "ბლენდერები და ჩოპერები"], "ჩოპერი", "Chopper"),
  "Mixer": c("small", [...ALTA_SMALL, "მიქსერები"], "მიქსერი", "Mixer"),
  "Juicer": c("small", [...ALTA_SMALL, "წვენსაწურები"], "წვენსაწური", "Juicer"),
  "Kettle": c("small", [...ALTA_SMALL, "ელექტრო ჩაიდნები"], "ელექტრო ჩაიდანი", "Kettle"),
  "Microwave": c("small", [...ALTA_SMALL, "მიკროტალღური ღუმელები"], "მიკროტალღური ღუმელი", "Microwave"),
  "Air Fryer": c("small", [...ALTA_SMALL, "აეროგრილები"], "აეროგრილი", "Air Fryer"),
  "Kitchen Machine": c("small", [...ALTA_SMALL, "სამზარეულოს კომბაინები"], "სამზარეულოს კომბაინი", "Kitchen Machine"),
  "Meat Machine": c("small", [...ALTA_SMALL, "ხორცსაკეპები"], "ხორცსაკეპი", "Meat Grinder"),
  "Toaster": c("small", [...ALTA_SMALL, "ტოსტერები და სენდვიჩ-მეიქერები"], "ტოსტერი", "Toaster"),
  "Sandwich Maker": c("small", [...ALTA_SMALL, "ტოსტერები და სენდვიჩ-მეიქერები"], "სენდვიჩ-მეიქერი", "Sandwich Maker"),
  "Waffle Maker": c("small", [...ALTA_SMALL, "ტოსტერები და სენდვიჩ-მეიქერები"], "ვაფლის აპარატი", "Waffle Maker"),
  "Grill": c("small", [...ALTA_SMALL, "გრილები"], "გრილი", "Grill"),
  "Multi Boiler": c("small", [...ALTA_SMALL, "სხვა სამზარეულოს ტექნიკა"], "მულტისახარში", "Multi Cooker"),
  "Bread Maker": c("small", [...ALTA_SMALL, "სხვა სამზარეულოს ტექნიკა"], "პურის საცხობი", "Bread Maker"),
  "Fruit Dryer": c("small", [...ALTA_SMALL, "სხვა სამზარეულოს ტექნიკა"], "ხილის საშრობი", "Fruit Dryer"),
  "Scale / Kitchen": c("small", [...ALTA_SMALL, "სხვა სამზარეულოს ტექნიკა"], "სამზარეულოს სასწორი", "Kitchen Scale"),
  "Accessories / SDA": c("small", [...ALTA_SMALL, "სამზარეულოს ტექნიკის აქსესუარები"]),
};

/** ახალი კატეგორიების თარგმანი (nameKa → [en, ru]) — შექმნისას გამოიყენება */
export const ALTA_CATEGORY_NAMES: Record<string, [string, string]> = {
  "მობილურები": ["Mobile phones", "Мобильные телефоны"],
  "სმარტფონები": ["Smartphones", "Смартфоны"],
  "სმარტ საათები": ["Smart Watches", "Смарт-часы"],
  "სმარტ საათის აქსესუარები": ["Smart Watch Accessories", "Аксессуары для смарт-часов"],
  "ქეისები და ეკრანის დამცავები": ["Cases & Screen Protectors", "Чехлы и защита экрана"],
  "დამტენები და კაბელები": ["Chargers & Cables", "Зарядные устройства и кабели"],
  "პორტატული დამტენები (Power Bank)": ["Power Banks", "Портативные аккумуляторы"],
  "პორტატული დინამიკები": ["Portable Speakers", "Портативные колонки"],
  "მობილურის აქსესუარები": ["Mobile Accessories", "Аксессуары для телефонов"],
  "გარე დისკები": ["External Drives", "Внешние диски"],
  "სკანერები": ["Scanners", "Сканеры"],
  "კარტრიჯები და ტონერები": ["Cartridges & Toners", "Картриджи и тонеры"],
  "კაბელები და ადაპტერები": ["Cables & Adapters", "Кабели и адаптеры"],
  "გეიმინგი": ["Gaming", "Гейминг"],
  "სათამაშო კონსოლები": ["Game Consoles", "Игровые консоли"],
  "კონსოლის აქსესუარები და თამაშები": ["Console Accessories & Games", "Аксессуары и игры для консолей"],
  "მსხვილი ტექნიკა": ["Large Appliances", "Крупная бытовая техника"],
  "წვრილი ტექნიკა": ["Small Appliances", "Мелкая бытовая техника"],
  "საშრობი მანქანები": ["Dryers", "Сушильные машины"],
  "გაზქურები": ["Cookers", "Плиты"],
  "ჩასაშენებელი ქურები": ["Built-in Hobs", "Встраиваемые варочные панели"],
  "ჩასაშენებელი ღუმელები": ["Built-in Ovens", "Встраиваемые духовки"],
  "გამწოვები": ["Hoods", "Вытяжки"],
  "საყოფაცხოვრებო კონდიციონერები": ["Home Air Conditioners", "Бытовые кондиционеры"],
  "გამათბობლები": ["Heaters", "Обогреватели"],
  "ბლენდერები და ჩოპერები": ["Blenders & Choppers", "Блендеры и измельчители"],
  "მიქსერები": ["Mixers", "Миксеры"],
  "წვენსაწურები": ["Juicers", "Соковыжималки"],
  "ელექტრო ჩაიდნები": ["Electric Kettles", "Электрочайники"],
  "მიკროტალღური ღუმელები": ["Microwave Ovens", "Микроволновые печи"],
  "აეროგრილები": ["Air Fryers", "Аэрогрили"],
  "სამზარეულოს კომბაინები": ["Kitchen Machines", "Кухонные комбайны"],
  "ხორცსაკეპები": ["Meat Grinders", "Мясорубки"],
  "ტოსტერები და სენდვიჩ-მეიქერები": ["Toasters & Sandwich Makers", "Тостеры и сэндвичницы"],
  "გრილები": ["Grills", "Грили"],
  "სხვა სამზარეულოს ტექნიკა": ["Other Kitchen Appliances", "Другая кухонная техника"],
  "სამზარეულოს ტექნიკის აქსესუარები": ["Kitchen Appliance Accessories", "Аксессуары для кухонной техники"],
};

/** „(TP)_Apple“ → „Apple“; „Delonghi“ → „DeLonghi“ */
export function altaBrand(brand: string | null | undefined): string | null {
  const b = (brand ?? "").replace(/^\([^)]*\)_?/, "").trim();
  if (!b) return null;
  if (/^delonghi$/i.test(b)) return "DeLonghi";
  return b;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tidy = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s+([,;])/g, "$1")
    .replace(/[\s,;/–—-]+$/, "")
    .trim();

/**
 * B2B-ის სახელი → სახელი ვიტრინისთვის ({ ka, en }).
 * გზის ბოლო სეგმენტია თვით სახელი („…/ Apple/ Apple iPhone 16 128GB White E-sim/TP“); ბრენდი წინ ემატება,
 * თუ შიგ არ წერია; როცა სახელი მხოლოდ მოდელია („Refrigerator/ GR-B22FFLZB.APYQMER“), ტიპი ერთვის ბოლოში.
 */
export function altaName(
  row: { name: string; brand?: string | null; model?: string | null; category?: string | null },
): { ka: string; en: string } {
  const brand = altaBrand(row.brand);
  // გზის გამყოფი „X/ Y“-ა (დახრილის წინ ჰარი არ არის); „ A / B “ თვით სახელის ნაწილია (მახასიათებლები)
  const segs = row.name.split(/(?<!\s)\/\s+/).map((s) => s.trim()).filter(Boolean);
  // წინა სეგმენტები გზის იარლიყებია: „Hob“, „AEG“, „PC Components“, „TV 65"(165cm)“, „2.5"“
  const isLabel = (s: string) =>
    (/^[A-Za-z][A-Za-z &.-]*$/.test(s) && s.split(/\s+/).length <= 3) || /^TV \d+["”]\(\d+cm\)$/i.test(s) || /^\d+(\.\d+)?["”]$/.test(s);
  let start = segs.findIndex((s, i) => i > 0 && !isLabel(s));
  if (start < 0) start = segs.length - 1;
  let last = segs.slice(Math.max(start, 0)).join(" / ") || row.name;
  last = last
    .replace(/\s*\/\s*(TP|KIA)$/i, "")
    .replace(/^\(Promo\)\s*/i, "")
    .replace(/^[A-Z]?\d{2,3}[A-Za-z]?\s+\/\s+(?=For\b)/i, "");
  // ბრენდი სახელის შუაში დიდი ასოებითაც წერია („… SENCOR“) — ბოლოდან ვაშორებთ, წინ ვამატებთ
  if (brand) {
    last = last.replace(new RegExp(`[\\s,/-]+${esc(brand)}$`, "i"), "");
    if (!new RegExp(`(^|[^a-z0-9])${esc(brand)}([^a-z0-9]|$)`, "i").test(last)) last = `${brand} ${last}`;
    else last = last.replace(new RegExp(`^${esc(brand)}(?=[^a-z0-9]|$)`, "i"), brand);
  }
  last = tidy(last);

  const cat = row.category ? ALTA_CATEGORIES[row.category] : undefined;
  let ka = last;
  let en = last;
  if (cat?.type) {
    // ტელევიზორს ზომა წინა სეგმენტში უწერია: „TV 65"(165cm)“
    const size = cat.segment === "tv" ? segs.join(" ").match(/\b(\d{2,3})\s?["”]/)?.[1] : undefined;
    const hasSize = size ? new RegExp(`\\b${size}\\s?["”]`).test(last) : true;
    const typed = new RegExp(`\\b(${esc(cat.type.en)}|${esc(cat.type.en.split(" ").at(-1)!)})\\b`, "i").test(last);
    const words = last.replace(brand ?? "", "").trim().split(/\s+/).length;
    if (!typed || words <= 2 || !hasSize) {
      const s = size && !hasSize ? `${size}" ` : "";
      ka = `${last} — ${s}${cat.type.ka}`;
      en = typed && hasSize ? last : `${last} — ${s}${cat.type.en}`;
    }
  }
  return { ka: ka.slice(0, 240), en: en.slice(0, 240) };
}
