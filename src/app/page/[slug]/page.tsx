import { notFound } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";

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

• ბარათით ონლაინ — Visa, Mastercard (უსაფრთხო გადახდა ბანკის გვერდზე)
• საბანკო გადარიცხვა — იურიდიული პირებისთვის, ინვოისის საფუძველზე
• განვადება — პარტნიორი ბანკების პირობებით

ყველა ფასი მოცემულია დღგ-ს ჩათვლით.`,
    },
    en: {
      title: "Payment terms",
      body: `We accept the following payment methods:

• Card online — Visa, Mastercard (secure payment on the bank's page)
• Bank transfer — for companies, against an invoice
• Installments — on the terms of our partner banks

All prices include VAT.`,
    },
    ru: {
      title: "Условия оплаты",
      body: `Принимаются следующие способы оплаты:

• Картой онлайн — Visa, Mastercard (безопасная оплата на странице банка)
• Банковский перевод — для юридических лиц, на основании счёта
• Рассрочка — на условиях банков-партнёров

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
  returns: {
    ka: {
      title: "დაბრუნების პოლიტიკა",
      body: `პროდუქტის დაბრუნება შესაძლებელია მიღებიდან 14 კალენდარული დღის განმავლობაში, თუ:

• შენარჩუნებულია სასაქონლო სახე და ორიგინალი შეფუთვა
• პროდუქტი არ ყოფილა გამოყენებული
• თან ახლავს შესყიდვის დამადასტურებელი დოკუმენტი

თანხის დაბრუნება ხდება 5-10 სამუშაო დღეში.`,
    },
    en: {
      title: "Return policy",
      body: `You can return a product within 14 calendar days of receiving it, provided that:

• its condition and original packaging are intact
• the product has not been used
• it is accompanied by proof of purchase

Refunds are made within 5–10 business days.`,
    },
    ru: {
      title: "Политика возврата",
      body: `Товар можно вернуть в течение 14 календарных дней с момента получения, если:

• сохранены товарный вид и оригинальная упаковка
• товар не был в использовании
• есть документ, подтверждающий покупку

Деньги возвращаются в течение 5–10 рабочих дней.`,
    },
  },
  privacy: {
    ka: {
      title: "კონფიდენციალურობის პოლიტიკა",
      body: `თქვენს პერსონალურ მონაცემებს ვამუშავებთ მხოლოდ შეკვეთის შესრულებისა და მომსახურების გაწევის მიზნით.

ჩვენ არ ვუზიარებთ თქვენს მონაცემებს მესამე პირებს, გარდა იმ შემთხვევებისა, როცა ეს აუცილებელია მიწოდების ან გადახდის უზრუნველსაყოფად.

გადახდის ბარათის მონაცემები მუშავდება მხოლოდ ბანკის მხარეს — ჩვენს სერვერზე არ ინახება.`,
    },
    en: {
      title: "Privacy policy",
      body: `We process your personal data only to fulfil your orders and provide our services.

We do not share your data with third parties, except where this is necessary for delivery or payment.

Payment card details are processed only by the bank — they are never stored on our server.`,
    },
    ru: {
      title: "Политика конфиденциальности",
      body: `Мы обрабатываем ваши персональные данные исключительно для выполнения заказов и оказания услуг.

Мы не передаём ваши данные третьим лицам, за исключением случаев, когда это необходимо для доставки или оплаты.

Данные платёжной карты обрабатываются только на стороне банка — на нашем сервере они не хранятся.`,
    },
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: PAGES[slug]?.[await getLocale()]?.title ?? "Enex" };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug]?.[await getLocale()];
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
