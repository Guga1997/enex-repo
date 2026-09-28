/**
 * კომპიუტერის კონფიგურატორის ხელშეკრულება (contract).
 *
 * კონფიგურატორი (ცალკე აპლიკაცია) enex.ge-ს API-დან იღებს პროდუქტებს და
 * მათი მახასიათებლებიდან კითხულობს ტექნიკურ პარამეტრებს. იმისთვის, რომ ორივე
 * მხარემ ერთი ენა ილაპარაკოს, მახასიათებლის სახელი ინგლისური გასაღებია
 * („socket“, „ramType“), საიტზე კი ქართულად ითარგმნება (i18n ლექსიკონი).
 *
 * კატეგორიის slug-ით აპი ხვდება, რომელი ნაწილია პროდუქტი.
 */

export type SpecField = {
  key: string;
  /** ქართული წარწერა ადმინისთვის */
  label: string;
  type: "text" | "number" | "select" | "multi" | "bool";
  options?: string[];
  unit?: string;
  required?: boolean;
};

export type PcCategory = {
  /** კონფიგურატორის კატეგორიის id */
  id: "cpu" | "mb" | "cooler" | "ram" | "gpu" | "storage" | "psu" | "case";
  slug: string;
  nameKa: string;
  nameEn: string;
  nameRu: string;
  /** რამდენიმე ერთეული ერთ აწყობაში (დისკები) */
  multi?: boolean;
  /** არასავალდებულო ნაწილი */
  optional?: boolean;
  fields: SpecField[];
};

export const SOCKETS = ["AM4", "AM5", "LGA1700", "LGA1851", "LGA1200"];
export const FORMS = ["ATX", "Micro-ATX", "Mini-ITX"];
export const RAM_TYPES = ["DDR4", "DDR5"];

export const PC_CATEGORIES: PcCategory[] = [
  {
    id: "cpu",
    slug: "procesorebi",
    nameKa: "პროცესორები",
    nameEn: "Processors",
    nameRu: "Процессоры",
    fields: [
      { key: "brand", label: "ბრენდი", type: "select", options: ["AMD", "Intel"], required: true },
      { key: "socket", label: "სოკეტი", type: "select", options: SOCKETS, required: true },
      { key: "cores", label: "ბირთვები", type: "number", required: true },
      { key: "threads", label: "ნაკადები", type: "number" },
      { key: "boost", label: "სიხშირე", type: "number", unit: "GHz" },
      { key: "tdp", label: "TDP", type: "number", unit: "W", required: true },
      { key: "igpu", label: "ჩაშენებული გრაფიკა", type: "bool" },
    ],
  },
  {
    id: "mb",
    slug: "dedadapebi",
    nameKa: "დედადაფები",
    nameEn: "Motherboards",
    nameRu: "Материнские платы",
    fields: [
      { key: "socket", label: "სოკეტი", type: "select", options: SOCKETS, required: true },
      { key: "chipset", label: "ჩიპსეტი", type: "text" },
      { key: "form", label: "ფორმ-ფაქტორი", type: "select", options: FORMS, required: true },
      { key: "ramType", label: "მეხსიერების ტიპი", type: "select", options: RAM_TYPES, required: true },
      { key: "ramSlots", label: "RAM სლოტები", type: "select", options: ["2", "4"], required: true },
      { key: "m2", label: "M.2 სლოტები", type: "number", required: true },
    ],
  },
  {
    id: "cooler",
    slug: "qulerebi",
    nameKa: "ქულერები",
    nameEn: "CPU coolers",
    nameRu: "Кулеры",
    optional: true,
    fields: [
      { key: "type", label: "ტიპი", type: "select", options: ["Air", "AIO 240", "AIO 360"], required: true },
      { key: "sockets", label: "სოკეტები", type: "multi", options: SOCKETS, required: true },
      { key: "tdp", label: "გაგრილების ზღვარი", type: "number", unit: "W", required: true },
      { key: "rgb", label: "RGB", type: "bool" },
    ],
  },
  {
    id: "ram",
    slug: "operatiuli-mekhsiereba",
    nameKa: "ოპერატიული მეხსიერება",
    nameEn: "Memory (RAM)",
    nameRu: "Оперативная память",
    fields: [
      { key: "ramType", label: "ტიპი", type: "select", options: RAM_TYPES, required: true },
      { key: "capacity", label: "მოცულობა (ჯამი)", type: "number", unit: "GB", required: true },
      { key: "modules", label: "მოდულები", type: "select", options: ["1", "2", "4"], required: true },
      { key: "speed", label: "სიხშირე", type: "number", unit: "MHz" },
      { key: "rgb", label: "RGB", type: "bool" },
    ],
  },
  {
    id: "gpu",
    slug: "videobaratebi",
    nameKa: "ვიდეობარათები",
    nameEn: "Graphics cards",
    nameRu: "Видеокарты",
    optional: true,
    fields: [
      { key: "brand", label: "ბრენდი", type: "select", options: ["NVIDIA", "AMD", "Intel"], required: true },
      { key: "vram", label: "ვიდეომეხსიერება", type: "number", unit: "GB", required: true },
      { key: "length", label: "სიგრძე", type: "number", unit: "mm", required: true },
      { key: "tdp", label: "მოხმარება", type: "number", unit: "W", required: true },
      { key: "rgb", label: "RGB", type: "bool" },
    ],
  },
  {
    id: "storage",
    slug: "diskebi-pc",
    nameKa: "დისკები (კომპიუტერისთვის)",
    nameEn: "Storage drives",
    nameRu: "Накопители",
    multi: true,
    fields: [
      { key: "type", label: "ტიპი", type: "select", options: ["NVMe M.2", "SATA SSD", "HDD"], required: true },
      { key: "capacity", label: "მოცულობა", type: "number", unit: "GB", required: true },
    ],
  },
  {
    id: "psu",
    slug: "kvebis-blokebi-pc",
    nameKa: "კვების ბლოკები",
    nameEn: "Power supplies",
    nameRu: "Блоки питания",
    fields: [
      { key: "watt", label: "სიმძლავრე", type: "number", unit: "W", required: true },
      { key: "rating", label: "სერტიფიკატი", type: "select", options: ["80+", "80+ Bronze", "80+ Gold", "80+ Platinum"] },
      { key: "modular", label: "მოდულარული", type: "bool" },
    ],
  },
  {
    id: "case",
    slug: "qeisebi",
    nameKa: "ქეისები",
    nameEn: "Cases",
    nameRu: "Корпуса",
    fields: [
      { key: "forms", label: "მხარდაჭერილი ფორმები", type: "multi", options: FORMS, required: true },
      { key: "maxGpu", label: "ვიდეობარათის მაქს. სიგრძე", type: "number", unit: "mm", required: true },
      { key: "color", label: "ფერი", type: "select", options: ["შავი", "თეთრი"] },
      { key: "fans", label: "ვენტილატორები", type: "number" },
      { key: "rgb", label: "RGB", type: "bool" },
    ],
  },
];

/** მშობელი კატეგორია, რომლის ქვეშაც ყველა ეს ჯგუფი დგას */
export const PC_ROOT = {
  slug: "kompiuteris-komponentebi",
  nameKa: "კომპიუტერის კომპონენტები",
  nameEn: "PC components",
  nameRu: "Компьютерные комплектующие",
};

export const bySlug = (slug: string) => PC_CATEGORIES.find((c) => c.slug === slug);
export const byId = (id: PcCategory["id"]) => PC_CATEGORIES.find((c) => c.id === id);
