import Link from "@/components/Link";
import Logo from "./Logo";
import { CONTACT, WHATSAPP_URL } from "@/lib/seo";
import WhatsAppIcon from "./WhatsAppIcon";
import { getT } from "@/lib/i18n/server";

export default async function Footer() {
  const t = await getT();
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo className="h-10 w-auto text-ink" />
          <p className="mt-3 text-sm text-muted">
            {t("პროფესიონალური აღჭურვილობის ონლაინ მაღაზია — გარანტიით და მიწოდებით საქართველოს მასშტაბით.")}
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("ინფორმაცია")}</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/page/about" className="hover:text-brand-600">{t("ჩვენ შესახებ")}</Link></li>
            <li><Link href="/page/delivery" className="hover:text-brand-600">{t("მიწოდების პირობები")}</Link></li>
            <li><Link href="/page/payment" className="hover:text-brand-600">{t("გადახდის პირობები")}</Link></li>
            <li><Link href="/page/warranty" className="hover:text-brand-600">{t("საგარანტიო მომსახურება")}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("დახმარება")}</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/order/track" className="hover:text-brand-600">{t("შეკვეთის სტატუსი")}</Link></li>
            <li><Link href="/page/returns" className="hover:text-brand-600">{t("დაბრუნების პოლიტიკა")}</Link></li>
            <li><Link href="/page/privacy" className="hover:text-brand-600">{t("კონფიდენციალურობა")}</Link></li>
            <li><Link href="/page/terms" className="hover:text-brand-600">{t("წესები და პირობები")}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("კონტაქტი")}</h3>
          <ul className="space-y-2 text-sm text-muted">
            {CONTACT.phone && (
              <li><a href={`tel:${CONTACT.phone.replace(/\s+/g, "")}`} className="hover:text-brand-600">{CONTACT.phone}</a></li>
            )}
            {WHATSAPP_URL && (
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-brand-600"
                >
                  <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                  WhatsApp
                </a>
              </li>
            )}
            <li><a href={`mailto:${CONTACT.email}`} className="hover:text-brand-600">{CONTACT.email}</a></li>
            <li>{t(CONTACT.address)}</li>
            <li className="pt-2">{t(CONTACT.hours)}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} Enex. {t("ყველა უფლება დაცულია.")}
      </div>
    </footer>
  );
}
