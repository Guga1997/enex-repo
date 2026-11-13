import type { Locale } from "@/lib/i18n/config";

/**
 * სტატიკური საინფორმაციო გვერდები (ჩვენ შესახებ, მიწოდება, გადახდა, გარანტია) — სამივე ენაზე.
 * ტექსტი რედაქტირდება პირდაპირ აქ. იყენებს: /page/[slug] და AI ასისტენტის API (/api/assistant/info).
 */
export type Page = { title: string; body: string };
export const PAGES: Record<string, Record<Locale, Page>> = {
  about: {
    ka: {
      title: "ჩვენ შესახებ",
      body: `ჩვენ ვთავაზობთ პროფესიონალურ აღჭურვილობას უსაფრთხოების, ქსელური და ენერგო სისტემებისთვის.

ვმუშაობთ როგორც კორპორატიულ, ისე კერძო მომხმარებლებთან. ყველა პროდუქტი ოფიციალურია და გააჩნია მწარმოებლის გარანტია.`,
    },
    en: {
      title: "About us",
      body: `We supply professional equipment for security, networking and power systems.

We work with both corporate and private customers. Every product is officially sourced and comes with the manufacturer's warranty.`,
    },
    ru: {
      title: "О нас",
      body: `Мы поставляем профессиональное оборудование для систем безопасности, сетей и электропитания.

Работаем как с корпоративными, так и с частными клиентами. Вся продукция официальная и имеет гарантию производителя.`,
    },
  },
  delivery: {
    ka: {
      title: "მიწოდების პირობები",
      body: `თბილისში მიწოდება ხორციელდება 1-2 სამუშაო დღეში.
რეგიონებში — 2-4 სამუშაო დღეში.

200₾-ზე მეტი შეკვეთისას მიწოდება უფასოა. ამ თანხაზე ნაკლები შეკვეთის მიწოდების ღირებულებაა 15₾.

შესაძლებელია თვითგატანა ჩვენი შოურუმიდან სამუშაო საათებში.`,
    },
    en: {
      title: "Delivery terms",
      body: `Delivery in Tbilisi takes 1–2 business days.
To the regions — 2–4 business days.

Delivery is free for orders over 200₾. For smaller orders the delivery fee is 15₾.

You can also pick up your order from our showroom during business hours.`,
    },
    ru: {
      title: "Условия доставки",
      body: `Доставка по Тбилиси — 1–2 рабочих дня.
В регионы — 2–4 рабочих дня.

При заказе от 200₾ доставка бесплатная. Для заказов на меньшую сумму стоимость доставки — 15₾.

Также возможен самовывоз из нашего шоурума в рабочее время.`,
    },
  },
  payment: {
    ka: {
      title: "გადახდის პირობები",
      body: `მიიღება შემდეგი გადახდის მეთოდები:

• ონლაინ, ბანკის გვერდზე — ბარათით (Visa, Mastercard), განვადებით ან ქულებით
• საბანკო გადარიცხვა — იურიდიული პირებისთვის, ინვოისის საფუძველზე
• ბარათით ადგილზე — POS ტერმინალით, ნივთის მიღებისას

ყველა ფასი მოცემულია დღგ-ს ჩათვლით.`,
    },
    en: {
      title: "Payment terms",
      body: `We accept the following payment methods:

• Online, on the bank's page — by card (Visa, Mastercard), in installments or with points
• Bank transfer — for companies, against an invoice
• Card on delivery — via POS terminal when you receive your order

All prices include VAT.`,
    },
    ru: {
      title: "Условия оплаты",
      body: `Принимаются следующие способы оплаты:

• Онлайн, на странице банка — картой (Visa, Mastercard), в рассрочку или баллами
• Банковский перевод — для юридических лиц, на основании счёта
• Картой при получении — через POS-терминал

Все цены указаны с НДС.`,
    },
  },
  warranty: {
    ka: {
      title: "საგარანტიო მომსახურების პირობები",
      body: `ყველა პროდუქტს გააჩნია მწარმოებლის ოფიციალური გარანტია.

საგარანტიო ვადა მითითებულია პროდუქტის მახასიათებლებში და საგარანტიო ტალონში.

გარანტია არ ვრცელდება მექანიკურ დაზიანებაზე, არასწორი ექსპლუატაციის შედეგად გამოწვეულ ხარვეზზე და ძაბვის ცვალებადობით მიღებულ დაზიანებაზე.`,
    },
    en: {
      title: "Warranty terms",
      body: `Every product comes with the manufacturer's official warranty.

The warranty period is listed in the product specifications and on the warranty card.

The warranty does not cover mechanical damage, faults caused by improper use, or damage caused by voltage fluctuations.`,
    },
    ru: {
      title: "Условия гарантийного обслуживания",
      body: `На всю продукцию распространяется официальная гарантия производителя.

Гарантийный срок указан в характеристиках товара и в гарантийном талоне.

Гарантия не распространяется на механические повреждения, неисправности, вызванные неправильной эксплуатацией, и повреждения от перепадов напряжения.`,
    },
  },
};
