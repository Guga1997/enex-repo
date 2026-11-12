/**
 * პროდუქტის კატეგორიის დაზუსტება დასახელებით.
 *
 * მიმწოდებლის კატეგორია ხშირად ზოგადია („Storage“, „UPS“, „Switches“) და პროდუქტი მშობელ
 * კატეგორიაში ჯდება — მყიდველი კი ქვეკატეგორიაში („SSD დისკები“) ეძებს და ვერ პოულობს.
 * აქ წესებია: „ამ კატეგორიაში მყოფი პროდუქტი, რომლის სახელიც ამას ჰგავს → იმ ქვეკატეგორიაში“.
 *
 * იყენებს: სინქი (ახალი და ზოგად კატეგორიაში მყოფი პროდუქტები) და scripts/sort-catalog.ts
 * (მთელი კატალოგის გადალაგება). წესი მხოლოდ მაშინ მოქმედებს, როცა პროდუქტი ზუსტად იმ
 * კატეგორიაშია, რომელზეც წესი წერია — სხვაგან ხელით გადატანილს არ ეხება.
 */

export const FALLBACK_CATEGORY = "დაუკატეგორიებელი (იმპორტი)";

const LAN = "LAN & WAN";
const AV = "აუდიო-ვიდეო";
const EN = "ენერგო უზრუნველყოფა";
const PC = "კომპიუტერული ტექნიკა";
const ST = "მონაცემთა შენახვა";
const OPT = "ოპტიკური ქსელი";
const SEC = "უსაფრთხოების სისტემები";

const P = {
  // მონაცემთა შენახვა
  ssd: [ST, "SSD დისკები"],
  hdd: [ST, "მყარი დისკები (შენახვა)"],
  nas: [ST, "NAS სერვერები"],
  servers: [ST, "სერვერები"],
  serverParts: [ST, "სერვერის და NAS კომპონენტები"],
  // UPS / კვება
  upsLine: [EN, "უწყვეტი კვების წყაროები UPS", "Line Interactive UPS"],
  upsOnline: [EN, "უწყვეტი კვების წყაროები UPS", "On-Line UPS"],
  upsAcc: [EN, "უწყვეტი კვების წყაროები UPS", "UPS აქსესუარები"],
  batCab: [EN, "აკუმულატორები", "აკუმულატორების კაბინეტები"],
  batLead: [EN, "აკუმულატორები", "ტყვია-მჟავას აკუმულატორები"],
  psu: [EN, "კვების ბლოკები"],
  offGrid: [EN, "მზის ენერგია", "Off-Grid ინვერტორები"],
  solarAcc: [EN, "მზის ენერგია", "აქსესუარები მზის ენერგიისთვის"],
  rcd: [EN, "ელექტროდამცავი მოწყობილობები", "გაჟონვის რელეები"],
  mcb: [EN, "ელექტროდამცავი მოწყობილობები", "ავტომატური ამომრთველები", "MCB ავტომატური ამომრთველები"],
  signalCable: [EN, "კაბელი", "საკომუნიკაციო კაბელი", "სასიგნალო კაბელები"],
  emergencyLight: [EN, "განათება", "საავარიო განათება"],
  switchEl: [EN, "ელ. ფურნიტურა და აქსესუარები", "ჩამრთველ-როზეტი", "ჩამრთველი"],
  plug: [EN, "ელ. ფურნიტურა და აქსესუარები", "ჩანგალ-როზეტი"],
  tools: [EN, "სამონტაჟო მასალები", "ინსტრუმენტები"],
  bluettiBat: [EN, "პორტატული ელსადგურები", "დამატებითი აკუმულატორები"],
  bluettiAcc: [EN, "პორტატული ელსადგურები", "პორტატული ელსადგურის აქსესუარები"],
  // კარადები
  rackWall: [LAN, "საკომუნიკაციო კარადები", "კედლის კარადები"],
  rackFloor: [LAN, "საკომუნიკაციო კარადები", "დასადგამი კარადები"],
  rackAcc: [LAN, "საკომუნიკაციო კარადები", "კარადის აქსესუარები"],
  pdu: [LAN, "საკომუნიკაციო კარადები", "კვების გამანაწილებლები (PDU)"],
  // ქსელი
  lanCable: [LAN, "LAN კაბელები"],
  lanCable100: [LAN, "LAN კაბელები", "LAN კაბელები 100% სპილენძით"],
  lanCable20: [LAN, "LAN კაბელები", "LAN კაბელები 20% სპილენძით"],
  patchCord: [LAN, "LAN კომპონენტები", "პაჩკორდები"],
  patchPanel: [LAN, "LAN კომპონენტები", "პაჩ-პანელები"],
  keystone: [LAN, "LAN კომპონენტები", "ქისტონები"],
  rj45: [LAN, "LAN კომპონენტები", "ჯეკები"],
  lanSocket: [LAN, "LAN კომპონენტები", "LAN როზეტები"],
  lanTools: [LAN, "LAN ინსტრუმენტები"],
  indAcc: [LAN, "ინდუსტრიული ქსელური მოწყობილობები", "ინდუსტრიული აქსესუარები"],
  firewall: [LAN, "როუტერები და Firewall-ები", "Firewall-ები"],
  license: [LAN, "როუტერები და Firewall-ები", "ლიცენზიები"],
  lte: [LAN, "როუტერები და Firewall-ები", "LTE როუტერები"],
  wifiRouter: [LAN, "როუტერები და Firewall-ები", "WiFi როუტერები"],
  ethRouter: [LAN, "როუტერები და Firewall-ები", "ეზერნეტ როუტერები"],
  ispAp: [LAN, "საპროვაიდერო WiFi", "დაშვების წერტილები (საპროვაიდერო)"],
  ispAcc: [LAN, "საპროვაიდერო WiFi", "საპროვაიდერო აქსესუარები"],
  ap: [LAN, "კორპორატიული WiFi", "დაშვების წერტილები Access Points"],
  poeLan: [LAN, "კორპორატიული WiFi", "PoE კვება (LAN)"],
  bridge: [LAN, "მაგისტრალური უსადენო ქსელები"],
  swManaged: [LAN, "სვიჩები (LAN)", "მართვადი სვიჩები"],
  swUnmanaged: [LAN, "სვიჩები (LAN)", "არამართვადი სვიჩები"],
  swManagedPoe: [LAN, "სვიჩები (LAN)", "მართვადი PoE სვიჩები (LAN)"],
  swUnmanagedPoe: [LAN, "სვიჩები (LAN)", "არამართვადი PoE სვიჩები (LAN)"],
  netPsu: [LAN, "ქსელის კვების ბლოკები"],
  // ოპტიკა
  sfp: [OPT, "SFP მოდულები"],
  mediaConv: [OPT, "მედია კონვერტორები"],
  fiberBox: [OPT, "პასიური კომპონენტები", "სპლიტერების ყუთები"],
  fiberAcc: [OPT, "პასიური კომპონენტები", "პასიური აქსესუარები"],
  // უსაფრთხოება
  ipCam: [SEC, "ვიდეო-მეთვალყურეობა", "IP კამერები"],
  analogCam: [SEC, "ვიდეო-მეთვალყურეობა", "ანალოგური კამერები"],
  nvr: [SEC, "ვიდეო-მეთვალყურეობა", "IP ვიდეო-ჩამწერები (NVR)"],
  dvr: [SEC, "ვიდეო-მეთვალყურეობა", "ანალოგური ვიდეო-ჩამწერები (DVR/XVR)"],
  camPsu: [SEC, "ვიდეო-მეთვალყურეობა", "კვების ბლოკები ანალოგური კამერებისთვის"],
  camAcc: [SEC, "ვიდეო-მეთვალყურეობა", "სამაგრები და აქსესუარები"],
  camPoeManaged: [SEC, "ვიდეო-მეთვალყურეობა", "სვიჩები", "მართვადი PoE სვიჩები"],
  camPoeUnmanaged: [SEC, "ვიდეო-მეთვალყურეობა", "სვიჩები", "არამართვადი PoE სვიჩები"],
  fireAddr: [SEC, "სახანძრო სიგნალიზაცია", "მისამართიანი სახანძრო სიგნალიზაცია"],
  fireConv: [SEC, "სახანძრო სიგნალიზაცია", "არამისამართიანი სახანძრო სიგნალიზაცია"],
  paAcc: [SEC, "გახმოვანების სისტემები", "გახმოვანების აქსესუარები"],
  speakers: [SEC, "გახმოვანების სისტემები", "ხმამაღლამოლაპარაკეები"],
  evac: [SEC, "საჯარო მაუწყებლობის და ევაკუაციის სისტემა"],
  access: [SEC, "დაშვების სისტემა და დომოფონები", "დაშვების სისტემა"],
  alarmDet: [SEC, "დაცვითი სიგნალიზაცია", "დეტექტორები"],
  alarmCtl: [SEC, "დაცვითი სიგნალიზაცია", "მართვის მოწყობილობები"],
  alarmPanel: [SEC, "დაცვითი სიგნალიზაცია", "საკონტროლო პანელები"],
  // აუდიო-ვიდეო / კომპიუტერი
  tvBox: [AV, "TV Box და სმარტ TV"],
  monitorAcc: [AV, "მონიტორის აქსესუარები"],
  interactive: [AV, "ინტერაქტიული ეკრანები"],
  dect: [AV, "VoIP", "Dect ტელეფონები"],
  phoneAcc: [AV, "VoIP", "ტელეფონის აქსესუარები"],
  laptop: [PC, "კომპიუტერები და ლეპტოპები", "ლეპტოპები"],
  desktop: [PC, "კომპიუტერები და ლეპტოპები", "დესკტოპ კომპიუტერები"],
  aio: [PC, "კომპიუტერები და ლეპტოპები", "მონობლოკები (All-in-One)"],
  tablet: [PC, "კომპიუტერები და ლეპტოპები", "ტაბლეტები"],
  kbMouse: [PC, "პერიფერია", "კლავიატურა და მაუსი"],
  headset: [PC, "პერიფერია", "ყურსასმენები და გარნიტურა"],
} satisfies Record<string, string[]>;

/** ახალი კატეგორიები, რომლებსაც წესები იყენებს — sort-catalog ქმნის, თუ არ არსებობს */
export const NEW_CATEGORIES: { path: string[]; nameEn: string; nameRu: string }[] = [
  { path: P.servers, nameEn: "Servers", nameRu: "Серверы" },
  { path: P.serverParts, nameEn: "Server and NAS components", nameRu: "Комплектующие для серверов и NAS" },
  { path: P.pdu, nameEn: "Power distribution units (PDU)", nameRu: "Блоки распределения питания (PDU)" },
  { path: P.psu, nameEn: "Power supplies", nameRu: "Блоки питания" },
  { path: P.emergencyLight, nameEn: "Emergency lighting", nameRu: "Аварийное освещение" },
  { path: P.tools, nameEn: "Tools", nameRu: "Инструменты" },
  { path: P.tvBox, nameEn: "TV boxes and smart TV", nameRu: "ТВ-приставки и смарт ТВ" },
  { path: P.monitorAcc, nameEn: "Monitor accessories", nameRu: "Аксессуары для мониторов" },
];

export type RuleInput = { name: string; brand?: string | null; model?: string | null; sku?: string | null };
type Rule = [test: RegExp | ((p: RuleInput, text: string) => boolean), target: string[] | ((p: RuleInput, text: string) => string[] | null)];

const POE = /po[eе]\b|პოე|hpwr|-pwr|fpoe|\b(124|185|240|370|410|740)w\b/i;
const model = (p: RuleInput) => (p.model ?? "").trim();

/** სვიჩი LAN-ის ხეში: მართვადი/არამართვადი × PoE */
function lanSwitch(p: RuleInput, text: string): string[] {
  const unmanaged = /unmanaged|არამართვადი|aolynk es100/i.test(text);
  const poe = POE.test(text) || /(P|PA|FP|P Pro|PL Pro)(\/demo)?$/i.test(model(p)) || /-HP\b/.test(text);
  if (unmanaged) return poe ? P.swUnmanagedPoe : P.swUnmanaged;
  return poe ? P.swManagedPoe : P.swManaged;
}

/** რეკი: 15U-მდე კედლისაა, ზემოთ — იატაკზე დასადგამი */
function rack(_p: RuleInput, text: string): string[] {
  const u = Number(text.match(/\b(\d{1,2})\s?U\b/)?.[1] ?? 0);
  return u > 0 && u <= 15 ? P.rackWall : P.rackFloor;
}

/** კატეგორიის სრული გზა („A > B“) → წესები რიგით; პირველი დამთხვევა იმარჯვებს */
const RULES: Record<string, Rule[]> = {
  [ST]: [
    [/transceiver/i, P.sfp],
    [/expansion card|^rail\b/i, P.serverParts],
    [/poweredge|\bdell pe\b|\bDD\d{4}\b/i, P.servers],
    [(p, t) => /\bnas\b|turbonas/i.test(t) || (/^qnap$/i.test(p.brand ?? "") && /^(TS|TVS)-/i.test(model(p))), P.nas],
    [/heat ?sink|\bHS Kit\b|adapter, pcie|\bHBA\b|port 1gbe|ddr[45].*(ecc|reg)/i, P.serverParts],
    [/\bssd\b/i, P.ssd],
    [/hard drive|\bhdd\b|\brpm\b/i, P.hdd],
  ],
  [`${EN} > უწყვეტი კვების წყაროები UPS`]: [
    [/\bPDU\b|basic type, 200-240 vac/i, P.pdu],
    [/rail kit for|rail kit \(|rm kit$|parallel kit|rack slide|management card|snmp|communications card|network interface is embedded|replacement battery/i, P.upsAcc],
    [/battery cabinet|\bEBC\b/i, P.batCab],
    [/\benot\b|battery 12v|12v \d+(\.\d+)? ?ah/i, P.batLead],
    [(p, t) => /^(BX|BVX|BV\d|SMT|SMC)/i.test(model(p)) || /back-ups|line.interactive|keor spx|keor multiplug/i.test(t), P.upsLine],
    [(p, t) => /^(SRV|SRT|UPS\d|UPA\d|TE\d)/i.test(model(p)) || /on-?line|smart-ups|daker|keor dk|\bVFI\b|უწყვეტი კვების წყარო|\bkva\b/i.test(t), P.upsOnline],
  ],
  [`${LAN} > საკომუნიკაციო კარადები`]: [
    [/ups rm kit|ups rt.*rail kit|parallel kit|რეკის სამაგრი rt|for conventional ups|gxt rack slide/i, P.upsAcc],
    [/sensor|სენსორ|netbotz/i, P.rackAcc],
    [/\bPDU\b|ელექტროენერგიის გამანაწილებ|rack ats/i, P.pdu],
    [/wall mount enclosure/i, P.rackWall],
    [/საკომუნიკაციო კარადა|სერვერის კარადა/i, rack],
    [/./, P.rackAcc],
  ],
  [`${SEC} > ვიდეო-მეთვალყურეობა`]: [
    [/კვების ბლოკი/, P.camPsu],
    [(p, t) => /^XVR/i.test(model(p)) || /ჰიბრიდული ჩამწერი|ანალოგური ჩამწერი/.test(t), P.dvr],
    [(p) => /^NVR/i.test(model(p)), P.nvr],
    [/კამერა(\s|,|$)/, P.ipCam],
    [/./, P.camAcc],
  ],
  [`${SEC} > ვიდეო-მეთვალყურეობა > სვიჩები`]: [
    [/მედია ?კონვერტორ/, P.mediaConv],
    [(p, t) => /edgecore/i.test(p.brand ?? "") || !POE.test(t), (p, t) => (/-\d+P$/i.test(model(p)) ? P.swManagedPoe : /არამართვადი|unmanaged/i.test(t) ? P.swUnmanaged : P.swManaged)],
    [(p, t) => !/არამართვადი/.test(t) && (/მართვადი|cloud|ქლაუდ|layer/i.test(t) || /^NSW[356]/i.test(model(p))), P.camPoeManaged],
    [/./, P.camPoeUnmanaged],
  ],
  [`${LAN} > სვიჩები (LAN)`]: [[/./, lanSwitch]],
  [`${LAN} > როუტერები და Firewall-ები`]: [
    [/\b\d year\b|utm protection|unified threat|forticare|license/i, P.license],
    [(p, t) => /^FG-/i.test(model(p)) || /fortigate/i.test(t), P.firewall],
    [/\b[45]G\b|\bLTE\b/, P.lte],
    [/wi-?fi/i, P.wifiRouter],
    [/./, P.ethRouter],
  ],
  [`${LAN} > საპროვაიდერო WiFi`]: [
    [/cable|surge|isolator|ხუფი/i, P.ispAcc],
    [/./, P.ispAp],
  ],
  [`${LAN} > საპროვაიდერო WiFi > დაშვების წერტილები (საპროვაიდერო)`]: [
    [/poe გარდამქმნელი/i, P.poeLan],
    [(p, t) => /^(UAP-|U6|U7)/i.test(model(p)) || /unifi access point/i.test(t), P.ap],
  ],
  [`${LAN} > ინდუსტრიული ქსელური მოწყობილობები`]: [[/./, P.indAcc]],
  [`${LAN} > LAN კომპონენტები`]: [
    [/\bcable\b.*(305|500) ?m|amp cable|outdoor cable/i, P.lanCable100],
    [/patch-?cord/i, P.patchCord],
    [/patch panel/i, P.patchPanel],
    [/modular plug/i, P.rj45],
    [/keystone|modular jack/i, P.keystone],
    [/euromod|wallplate/i, P.lanSocket],
    [/პრინტერი|ლამინირებული/, P.lanTools],
  ],
  [`${LAN} > ქსელის აქსესუარები`]: [[/euromod|wallplate|surface box/i, P.lanSocket]],
  [`${LAN} > LAN კაბელები`]: [
    [/20% ?(cca|სპილენძ)|\bcca\b/i, P.lanCable20],
    [/100% ?სპილენძ|სუფთა სპილენძ/i, P.lanCable100],
  ],
  [`${LAN} > კონტროლერები`]: [[/სახის ამომცნობი/, P.access]],
  [AV]: [
    [/tv box/i, P.tvBox],
    [(p) => /^cmx$/i.test(p.brand ?? ""), P.paAcc],
  ],
  [`${AV} > მონიტორები`]: [
    [/interactive display/i, P.interactive],
    [/monitor arm|arm monitor|monitor stand|all-in-one stand|hdmi.*cable|soundbar|კედლის საკიდი/i, P.monitorAcc],
  ],
  // MUK-ის „Interactive Whiteboard“ — ჩვენთან ერთი კატეგორიაა: ყველაფერი ეკრანებში გადადის
  [`${AV} > ინტერაქტიული დაფები`]: [[() => true, P.interactive]],
  [`${AV} > VoIP > IP ტელეფონები`]: [
    [/\bdect\b/i, P.dect],
    [/expansion module/i, P.phoneAcc],
  ],
  [`${SEC} > გახმოვანების სისტემები`]: [
    [/დინამიკი/, P.speakers],
    [/საევაკუაციო გახმოვანებ|ევაკუაციის სისტემ/, P.evac],
    [/./, P.paAcc],
  ],
  [EN]: [
    [/ინვერტორი/, P.offGrid],
    [(p, t) => /mikrotik/i.test(p.brand ?? "") && /კვების ბლოკი/.test(t), P.netPsu],
    [/კვების ბლოკი|^DC-\d+V/i, P.psu],
  ],
  [`${EN} > ელექტროდამცავი მოწყობილობები`]: [[/გაჟონვის რელე/, P.rcd]],
  [`${EN} > ელექტროდამცავი მოწყობილობები > ავტომატური ამომრთველები`]: [[/ავტომატური ამომრთველი.*\d+ ?KA/i, P.mcb]],
  [`${EN} > მზის ენერგია > ჰიბრიდული ინვერტორები`]: [[/კაბელი|მრიცხველი/, P.solarAcc]],
  [`${EN} > მზის ენერგია > On-Grid ინვერტორები`]: [[/wifi მოდული/i, P.solarAcc]],
  [`${OPT} > პასიური კომპონენტები`]: [
    [/termination box|terminal box/i, P.fiberBox],
    [/sleeves|მილაკი|protective box/i, P.fiberAcc],
  ],
  [`${OPT} > შედუღების აპარატები და აქსესუარები`]: [
    [/ტელევიზია|ტვ ბოქსი|tv box/i, P.tvBox],
    [/უსადენო ქსელის დამაკავშირებელი/, P.bridge],
  ],
  [`${SEC} > დაცვითი სიგნალიზაცია`]: [[/კაბელი/, P.signalCable]],
  [`${SEC} > სახანძრო სიგნალიზაცია`]: [
    [(p, t) => /^otc$/i.test(p.brand ?? "") || /ავარიული სანათი|საევაკუაციო მანიშნებელ|საავარიო განათ/.test(t), P.emergencyLight],
    [/არასამისამართო|არსამისამართო|ანალოგური/, P.fireConv],
    [/სამისამართო|მარყუჟ|პანელთაშორისი|დეტექტორის ბაზა|ღილაკის ძირი/, P.fireAddr],
    [(p, t) => /^cofem$/i.test(p.brand ?? "") || /სხივური დეტექტორი/.test(t), P.fireConv],
  ],
  [`${SEC} > სახანძრო სიგნალიზაცია > არამისამართიანი სახანძრო სიგნალიზაცია`]: [[/^სამისამართო/, P.fireAddr]],
  [`${SEC} > სახანძრო სიგნალიზაცია > მისამართიანი სახანძრო სიგნალიზაცია`]: [[/^არასამისამართო/, P.fireConv]],
  [`${SEC} > ვიდეო-მეთვალყურეობა > ანალოგური კამერები`]: [[(p, t) => /^XVR/i.test(model(p)) && !/კომპლექტი/.test(t), P.dvr]],
  [`${SEC} > ვიდეო-მეთვალყურეობა > IP კამერები`]: [[/^ანალოგური კამერა/, P.analogCam]],
  [`${PC} > კომპიუტერები და ლეპტოპები > დესკტოპ კომპიუტერები`]: [[/\bAIO\b|all-in-one/i, P.aio]],
  // „დაუკატეგორიებელი“ — მიმწოდებლის კატეგორია ვერ ამოვიცანით, სახელით ვცდილობთ
  [FALLBACK_CATEGORY]: [
    [(p) => /^(biotech|laboratoire ccd)$/i.test(p.brand ?? ""), () => null], // სამედიცინო — ჩვენი პროფილი არ არის
    [/expansion battery/i, P.bluettiBat],
    [(p) => /^bluetti$/i.test(p.brand ?? ""), P.bluettiAcc],
    [/keyboard and mouse|presenter mouse|keyboard -|mouse -/i, P.kbMouse],
    [/\btab\b/i, P.tablet],
    [/\bbuds\b|headset|earbuds/i, P.headset],
    [/pro slim|pro tower|thinkcentre|\bqcs\d|\bqct\d/i, P.desktop],
    [/legion|\bloq\b|thinkbook|thinkpad|yoga|ideapad|alienware|\bv15\b|dell (pro )?1[3-8]\b/i, P.laptop],
    [/\bAP\d|access point|wi-fi 6 ap/i, P.ap],
    [/მაგნიტური კონტაქტ|დეტექტო|bracket|კრონშტეინი/i, P.alarmDet],
    [/კლავიატურა|პულტი/, P.alarmCtl],
    [/საკონტროლო პანელი|გამაფართოვებელი|მიმღები|გადამცემი|ინტერფეისი|უსაფრთხოების სისტემის ცენტრ/, P.alarmPanel],
    [/ელექტრო საკეტი|დაშვების კო|მაგნიტური ბარათი|ბრელოკი/, P.access],
    [/ჩამრთველი/, P.switchEl],
    [/ელ\.? ?ჩანგალი/, P.plug],
    [/ბურღის პირი/, P.tools],
    [/უსადენო დამაკავშირებ|ქსელის უსადენო/, P.bridge],
    [/\bMR\.CMD/i, P.rackAcc],
  ],
};

/** ცალკეული კოდები, რომლებსაც სახელი არ შველის (სუფთა სპილენძი ატრიბუტში წერია და ა.შ.) */
const BY_SKU: Record<string, string[]> = {
  "000785": P.lanCable100,
  "02850": P.lanCable100,
  "915048": P.lanCable100,
  "915049": P.lanCable100,
  "01379": P.tvBox, // TV Box-ის კვების ბლოკი
  "03881": P.fireConv,
};

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * `path` — პროდუქტის ამჟამინდელი კატეგორიის გზა ძირიდან. აბრუნებს ახალ გზას ან null-ს (დარჩეს).
 * რამდენიმე ნაბიჯიც შეიძლება დასჭირდეს (LAN კომპონენტები → LAN კაბელები → 100% სპილენძით),
 * ამიტომ შედეგზე ისევ ვუშვებთ, სანამ იცვლება.
 */
export function refineCategory(p: RuleInput, path: string[]): string[] | null {
  let cur = path;
  for (let hop = 0; hop < 3; hop++) {
    const next = step(p, cur);
    if (!next || same(next, cur)) break;
    cur = next;
  }
  return same(cur, path) ? null : cur;
}

function step(p: RuleInput, path: string[]): string[] | null {
  if (p.sku && BY_SKU[p.sku]) return BY_SKU[p.sku];
  const rules = RULES[path.join(" > ")];
  if (!rules) return null;
  const text = `${p.name} ${p.model ?? ""}`.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  for (const [test, target] of rules) {
    const hit = typeof test === "function" ? test(p, text) : test.test(text);
    if (!hit) continue;
    return typeof target === "function" ? target(p, text) : target;
  }
  return null;
}

