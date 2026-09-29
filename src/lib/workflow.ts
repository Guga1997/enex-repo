/**
 * შეკვეთის მუშა პროცესი — ოთხი განყოფილება, ათი ნაბიჯი.
 *
 * შეკვეთა ერთდროულად უჩნდება გაყიდვებს, შესყიდვებსა და ბუღალტერიას; შემდეგ
 * ნაბიჯები რიგრიგობით იხსნება. აქ ერთ ადგილას წერია, თითოეულ ნაბიჯს ვინ
 * ასრულებს, რა სჭირდება წინაპირობად და ვინ ხედავს რომელ მონაცემს — ამას ეყრდნობა
 * როგორც ინტერფეისი, ისე სერვერული შემოწმება.
 */

export const ROLES = ["ADMIN", "SALES", "PURCHASING", "ACCOUNTING", "DELIVERY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "ადმინისტრატორი",
  SALES: "გაყიდვები",
  PURCHASING: "შესყიდვები",
  ACCOUNTING: "ბუღალტერია",
  DELIVERY: "მიწოდება",
};

export const STEPS = [
  "PAYMENT_CONFIRMED",
  "SUPPLIER_INVOICE",
  "SUPPLIER_PAID",
  "DELIVERY_REQUEST",
  "PICKUP_CONFIRMED",
  "WAYBILL",
  "DELIVERED",
] as const;
export type Step = (typeof STEPS)[number];

export type StepDef = {
  step: Step;
  /** ნომერი PDF-ის სქემიდან */
  no: number;
  title: string;
  /** ვის ევალება */
  role: Exclude<Role, "ADMIN">;
  /** რა უნდა იყოს დადასტურებული მანამდე */
  needs: Step[];
  hint: string;
};

export const STEP_DEFS: StepDef[] = [
  {
    step: "PAYMENT_CONFIRMED",
    no: 2,
    title: "თანხის ჩარიცხვის დადასტურება",
    role: "ACCOUNTING",
    needs: [],
    hint: "სანამ ბუღალტერია არ დაადასტურებს, შეკვეთა შემდეგ ეტაპზე არ გადადის.",
  },
  {
    step: "SUPPLIER_INVOICE",
    no: 4,
    title: "მომწოდებლის ინვოისი და აღების მისამართი",
    role: "PURCHASING",
    needs: ["PAYMENT_CONFIRMED"],
    hint: "ატვირთე ინვოისი და მიუთითე, რომელი საწყობიდან უნდა წამოვიდეს პროდუქტი.",
  },
  {
    step: "SUPPLIER_PAID",
    no: 5,
    title: "მომწოდებელთან გადარიცხვა",
    role: "ACCOUNTING",
    needs: ["SUPPLIER_INVOICE"],
    hint: "ინვოისის საფუძველზე გადარიცხვა და დადასტურება.",
  },
  {
    step: "DELIVERY_REQUEST",
    no: 7,
    title: "მიწოდების განაცხადი",
    role: "SALES",
    needs: ["SUPPLIER_PAID"],
    hint: "წონა, ზომები, აღების მისამართი და მომხმარებლის რეკვიზიტები.",
  },
  {
    step: "PICKUP_CONFIRMED",
    no: 8,
    title: "აღების ადგილზე მისვლა",
    role: "DELIVERY",
    needs: ["DELIVERY_REQUEST"],
    hint: "კურიერი ადასტურებს, რომ მომწოდებლის საწყობში მივიდა.",
  },
  {
    step: "WAYBILL",
    no: 9,
    title: "ზედნადები",
    role: "ACCOUNTING",
    needs: ["PICKUP_CONFIRMED"],
    hint: "ორივე მისამართი ერთად ჩანს: საიდან იღებენ და ვისთან მიაქვთ.",
  },
  {
    step: "DELIVERED",
    no: 10,
    title: "მომხმარებელთან მიტანა",
    role: "DELIVERY",
    needs: ["WAYBILL"],
    hint: "პროცესის დასასრული.",
  },
];

export const stepDef = (step: Step) => STEP_DEFS.find((s) => s.step === step)!;

/** როლი ასრულებს თუ არა ამ ნაბიჯს (ადმინი ყველაფერს) */
export const canDo = (role: string, step: Step) => role === "ADMIN" || stepDef(step).role === role;

/** ნაბიჯი ხელმისაწვდომია, თუ წინაპირობები დადასტურებულია */
export const isOpen = (step: Step, done: Set<string>) =>
  !done.has(step) && stepDef(step).needs.every((n) => done.has(n));

/* ------------------------------ ვინ რას ხედავს ------------------------------ */

export const FIELDS = [
  "order", // შეკვეთა და კლიენტის რეკვიზიტები
  "payment", // თანხის ჩარიცხვის დასტური
  "supplierInvoice", // მომწოდებლის ინვოისი
  "pickup", // აღების მისამართი და დრო
  "dimensions", // წონა და ზომები
  "customerAddress", // მომხმარებლის მისამართი
] as const;
export type Field = (typeof FIELDS)[number];

/**
 * ხედვის მატრიცა PDF-იდან. მიწოდება შეკვეთას მხოლოდ განაცხადის შემდეგ ხედავს,
 * გაყიდვები კი აღების მისამართს — მომწოდებელთან გადარიცხვის შემდეგ.
 */
const VIEW: Record<Field, Partial<Record<Role, true | { after: Step }>>> = {
  order: { SALES: true, PURCHASING: true, ACCOUNTING: true, DELIVERY: { after: "DELIVERY_REQUEST" } },
  payment: { SALES: true, PURCHASING: true, ACCOUNTING: true },
  supplierInvoice: { PURCHASING: true, ACCOUNTING: true },
  pickup: { SALES: { after: "SUPPLIER_PAID" }, PURCHASING: true, ACCOUNTING: true, DELIVERY: true },
  dimensions: { SALES: true, ACCOUNTING: true, DELIVERY: true },
  customerAddress: { SALES: true, ACCOUNTING: true, DELIVERY: true },
};

export function canSee(role: string, field: Field, done: Set<string>): boolean {
  if (role === "ADMIN") return true;
  const rule = VIEW[field][role as Role];
  if (!rule) return false;
  return rule === true || done.has(rule.after);
}

/** რომელ ნაბიჯზეა შეკვეთა — პირველი შეუსრულებელი */
export function currentStep(done: Set<string>): StepDef | null {
  return STEP_DEFS.find((d) => !done.has(d.step)) ?? null;
}

export const isFinished = (done: Set<string>) => done.has("DELIVERED");
