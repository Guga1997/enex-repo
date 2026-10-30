import { notFound } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import LegalText from "@/components/LegalText";
import { returns } from "@/content/legal/returns";
import { privacy } from "@/content/legal/privacy";

export const dynamic = "force-dynamic";

/**
 * სტატიკური საინფორმაციო გვერდები. ტექსტი რედაქტირდება პირდაპირ აქ — სამივე ენაზე.
 * თუ დაგჭირდა ადმინიდან მართვა, ეს ობიექტი ბაზის ცხრილით ჩანაცვლდება.
 */
type Page = { title: string; body: string };
const PAGES: Record<string, Record<Locale, Page>> = {
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

/** იურიდიული დოკუმენტები — სათაურებით, სიებით და ცხრილებით (LegalText) */
const LEGAL: Record<string, Record<Locale, Page>> = { returns, privacy };

export function generateStaticParams() {
  return [...Object.keys(PAGES), ...Object.keys(LEGAL)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  return { title: (PAGES[slug] ?? LEGAL[slug])?.[locale]?.title ?? "Enex" };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const legal = LEGAL[slug]?.[locale];
  if (legal) {
    return (
      <>
        <Suspense>
          <Header />
        </Suspense>
        <main className="container-x max-w-3xl py-10">
          <h1 className="mb-6 text-2xl font-bold">{legal.title}</h1>
          <div className="card p-6">
            <LegalText body={legal.body} />
          </div>
        </main>
        <Footer />
      </>
    );
  }
  const page = PAGES[slug]?.[locale];
  if (!page) notFound();

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x max-w-3xl py-10">
        <h1 className="mb-6 text-2xl font-bold">{page.title}</h1>
        <div className="card whitespace-pre-line p-6 text-sm leading-relaxed">{page.body}</div>
      </main>
      <Footer />
    </>
  );
}
