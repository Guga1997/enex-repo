/**
 * Elvare-ს კატეგორიების ხე „ენერგო უზრუნველყოფის“ ქვეშ (იხ. ourCategoryPath).
 * კატალოგს API-დან კითხულობს და რაც აკლია, იმას ქმნის — არსებულს არ ეხება.
 * გაჟონვის რელეების ძველი კატეგორია შეცდომიანი სახელით („გაჯონვის“) და გამორთული
 * იყო — სწორდება და ირთვება.
 *
 *   ELV_P=<პაროლი> npx tsx scripts/elvare-categories.ts   (ან Elvare მიმწოდებლის secret-იდან)
 */
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/format";
import { elvare } from "../src/lib/suppliers/elvare";

/** ka → [en, ru]; ლათინური კოდები (ABC, NYM…) სამივე ენაზე ერთნაირია */
const NAMES: Record<string, [string, string]> = {
  "კაბელი": ["Cable", "Кабель"],
  "სამონტაჟო კაბელი": ["Installation cable", "Монтажный кабель"],
  "საკომუნიკაციო კაბელი": ["Communication cable", "Коммуникационный кабель"],
  "მაღალი ძაბვის კაბელი": ["High-voltage cable", "Высоковольтный кабель"],
  "კოაქსიალური კაბელები": ["Coaxial cables", "Коаксиальные кабели"],
  "სასიგნალო კაბელები": ["Signal cables", "Сигнальные кабели"],
  "კაბელის გაყვანილობის სისტემები": ["Cable management systems", "Системы прокладки кабеля"],
  "გოფრირებული მილები": ["Corrugated conduits", "Гофрированные трубы"],
  "გოფრ. მილი HF ერთშრიანი": ["Single-wall HF corrugated conduit", "Гофротруба HF однослойная"],
  "გოფრ. მილი UV-მდგრადი ერთშრიანი": ["Single-wall UV-resistant corrugated conduit", "Гофротруба УФ-стойкая однослойная"],
  "გოფრ. მილი ერთშრიანი": ["Single-wall corrugated conduit", "Гофротруба однослойная"],
  "გოფრ. მილი თვითქრობადი ერთშრიანი": ["Single-wall self-extinguishing corrugated conduit", "Гофротруба самозатухающая однослойная"],
  "გოფრ. მილი ორშრიანი": ["Double-wall corrugated conduit", "Гофротруба двухслойная"],
  "გოფრ. მილის აქსესუარი": ["Corrugated conduit accessories", "Аксессуары для гофротрубы"],
  "მეტალის კაბელ არხები": ["Metal cable trays", "Металлические кабельные лотки"],
  "პლასტმასის კაბელ არხები": ["Plastic cable trunking", "Пластиковые кабель-каналы"],
  "მყარი მილები და აქსესუარები": ["Rigid conduits and accessories", "Жёсткие трубы и аксессуары"],
  "მყარი მილები": ["Rigid conduits", "Жёсткие трубы"],
  "მყარი მილის აქსესუარები": ["Rigid conduit accessories", "Аксессуары для жёстких труб"],
  "MCB ავტომატური ამომრთველები": ["MCB circuit breakers", "Автоматические выключатели MCB"],
  "MCCB ელექტრონული გამთიშველით": ["MCCB with electronic release", "MCCB с электронным расцепителем"],
  "MCCB თბო-მაგნიტური გამთიშველით": ["MCCB with thermal-magnetic release", "MCCB с термомагнитным расцепителем"],
  "ძრავის დაცვის ავტომატური ამომრთველი": ["Motor protection circuit breakers", "Автоматы защиты двигателя"],
  "რელე": ["Relays", "Реле"],
  "ელექტრომაგნიტური რელე": ["Electromagnetic relays", "Электромагнитные реле"],
  "ფოტორელე": ["Photo relays", "Фотореле"],
  "ძაბვის ვარდნისა და გადაძაბვისგან დამცავი რელე": ["Under/overvoltage protection relays", "Реле защиты от пониженного и повышенного напряжения"],
  "კონტაქტორები": ["Contactors", "Контакторы"],
  "კონტაქტორი": ["Contactors", "Контакторы"],
  "მინიატურული კონტაქტორი": ["Miniature contactors", "Миниатюрные контакторы"],
  "მოდულური კონტაქტორი": ["Modular contactors", "Модульные контакторы"],
  "ჭკვიანი გამთიშველი": ["Smart switches", "Умные выключатели"],
  "ბლოკ-კონტაქტი": ["Auxiliary contacts", "Блок-контакты"],
  "სახაზო გამთიშველი": ["Line disconnectors", "Линейные разъединители"],
  "საჰაერო გამთიშველი": ["Air circuit breakers", "Воздушные автоматические выключатели"],
  "მაღალი ძაბვის დაცვის მოწყობილობები": ["High-voltage protection devices", "Устройства защиты высокого напряжения"],
  "ვაკუუმური გამთიშველი": ["Vacuum circuit breakers", "Вакуумные выключатели"],
  "დატვირთის გამთიშველი": ["Load break switches", "Выключатели нагрузки"],
  "ელ. ფურნიტურა და აქსესუარები": ["Electrical fittings and accessories", "Электрофурнитура и аксессуары"],
  "ჩამრთველ-როზეტი": ["Switches and sockets", "Выключатели и розетки"],
  "როზეტი": ["Sockets", "Розетки"],
  "ჩამრთველი": ["Switches", "Выключатели"],
  "ჩარჩო": ["Frames", "Рамки"],
  "იატაკის სამონტაჟო კოლოფი და აქსესუარები": ["Floor boxes and accessories", "Напольные монтажные коробки и аксессуары"],
  "ჩანგალ-როზეტი": ["Plugs and sockets", "Вилки и розетки"],
  "სამონტაჟო კოლოფი": ["Mounting boxes", "Монтажные коробки"],
  "დამაგრძელებელი": ["Extension leads", "Удлинители"],
  "სამონტაჟო კარადები": ["Electrical cabinets", "Электрические шкафы"],
  "სამონტაჟო ყუთი": ["Enclosures", "Монтажные боксы"],
  "კედლის კარადები": ["Wall-mounted cabinets", "Настенные шкафы"],
  "დასადგმელი კარადები": ["Floor-standing cabinets", "Напольные шкафы"],
  "სამონტაჟო მასალები": ["Installation materials", "Монтажные материалы"],
  "საიზოლაციო ლენტი": ["Insulating tape", "Изолента"],
  "ცალუღები": ["Cable ties", "Кабельные стяжки"],
  "სკობები": ["Cable clips", "Скобы"],
  "დუბელი, უნაგირი": ["Wall plugs and saddles", "Дюбели и сёдла"],
  "გამანაწილებელი კოლოფი": ["Junction boxes", "Распределительные коробки"],
  "კლემნიკები": ["Terminal blocks", "Клеммники"],
  "დინ რეიკა": ["DIN rails", "DIN-рейки"],
  "შემაერთებელი სალტე": ["Connection clamps", "Соединительные хомуты"],
  "ბუნიკი": ["Cable lugs", "Кабельные наконечники"],
  "ვაზნა": ["Lamp holders", "Патроны"],
  "სიპის აქსესუარი": ["SIP accessories", "Аксессуары СИП"],
  "გამანაწილებელი ბლოკი LV": ["LV distribution blocks", "Распределительные блоки НН"],
  "გამაფრთხილებელი ლენტი": ["Warning tape", "Сигнальная лента"],
  "ჩამრთველი ღილაკი": ["Push buttons", "Кнопки"],
  "ნათურა-ინდიკატორი": ["Indicator lamps", "Индикаторные лампы"],
  "განათება": ["Lighting", "Освещение"],
  "ნათურა": ["Light bulbs", "Лампы"],
  "დიოდური პანელი": ["LED panels", "LED-панели"],
  "სანათი": ["Luminaires", "Светильники"],
  "პროჟექტორი": ["Floodlights", "Прожекторы"],
  "განათების აქსესუარები": ["Lighting accessories", "Аксессуары для освещения"],
  "დამიწების სისტემები": ["Earthing systems", "Системы заземления"],
  "საკაბელო ქუროები და თერმული მილები": ["Cable joints and heat-shrink tubing", "Кабельные муфты и термоусадочные трубки"],
  "თერმული მილი": ["Heat-shrink tubing", "Термоусадочные трубки"],
  "საკაბელო ქუროები და აქსესუარები": ["Cable joints and accessories", "Кабельные муфты и аксессуары"],
};

const georgian = /[Ⴀ-ჿ]/;

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "category";
  for (let i = 0; ; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    if (!(await db.category.findUnique({ where: { slug } }))) return slug;
  }
}

(async () => {
  const supplier = await db.supplier.findUnique({ where: { slug: "elvare" } });
  const secret = supplier?.secret ?? (process.env.ELV_P ? `enex:${process.env.ELV_P}` : null);
  if (!secret) throw new Error("Elvare-ს პაროლი: ELV_P ან მიმწოდებლის secret");
  const items = await elvare.fetchItems({
    slug: "elvare", name: "Elvare", baseUrl: supplier?.baseUrl ?? null, authType: "NONE", secret, authHeader: null, fieldMap: null,
  });

  // გაჟონვის რელეები — სახელი სწორდება მანამ, სანამ გზით ვეძებთ
  const energy = await db.category.findFirst({ where: { nameKa: "ენერგო უზრუნველყოფა", parentId: null } });
  if (!energy) throw new Error("„ენერგო უზრუნველყოფა“ ვერ მოიძებნა");
  const prot = await db.category.findFirst({ where: { nameKa: "ელექტროდამცავი მოწყობილობები", parentId: energy.id } });
  const leak = prot && (await db.category.findFirst({ where: { parentId: prot.id, nameKa: { in: ["გაჯონვის რელეები", "გაჟონვის რელეები"] } } }));
  if (leak) {
    await db.category.update({
      where: { id: leak.id },
      data: { nameKa: "გაჟონვის რელეები", nameEn: "Residual current relays", nameRu: "Реле утечки тока", isActive: true },
    });
  }

  const paths = new Map<string, string[]>();
  for (const i of items) if (i.categoryPath) paths.set(i.categoryPath.join(" > "), i.categoryPath);

  let created = 0;
  const missing = new Set<string>();
  for (const path of [...paths.values()].sort((a, b) => a.join().localeCompare(b.join()))) {
    let parentId: string | null = null;
    for (const [depth, name] of path.entries()) {
      const found: { id: string; isActive: boolean } | null = await db.category.findFirst({
        where: { parentId, nameKa: name },
        select: { id: true, isActive: true },
      });
      if (found) {
        if (!found.isActive) await db.category.update({ where: { id: found.id }, data: { isActive: true } });
        parentId = found.id;
        continue;
      }
      if (depth === 0) throw new Error(`ძირეული კატეგორია „${name}“ არ არსებობს`);
      const tr = NAMES[name] ?? (georgian.test(name) ? null : ([name, name] as [string, string]));
      if (!tr) missing.add(name);
      const siblings = await db.category.count({ where: { parentId } });
      const c: { id: string } = await db.category.create({
        data: {
          slug: await uniqueSlug(tr?.[0] ?? name),
          nameKa: name, nameEn: tr?.[0] ?? null, nameRu: tr?.[1] ?? null,
          parentId, sortOrder: siblings, isActive: true,
        },
        select: { id: true },
      });
      created++;
      console.log("+", path.slice(0, depth + 1).join(" > "));
      parentId = c.id;
    }
  }
  console.log(`შეიქმნა ${created}; Elvare-ს გზები: ${paths.size}; კატეგორიის გარეშე: ${items.filter((i) => !i.categoryPath).length}`);
  if (missing.size) console.log("თარგმანი აკლია:", [...missing].join(", "));
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
