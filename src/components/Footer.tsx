import Link from "next/link";
import Logo from "./Logo";
import { CONTACT } from "@/lib/seo";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo className="h-10 w-auto text-ink" />
          <p className="mt-3 text-sm text-muted">
            პროფესიონალური აღჭურვილობის ონლაინ მაღაზია — გარანტიით და მიწოდებით
            საქართველოს მასშტაბით.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">ინფორმაცია</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/page/about" className="hover:text-brand-600">ჩვენ შესახებ</Link></li>
            <li><Link href="/page/delivery" className="hover:text-brand-600">მიწოდების პირობები</Link></li>
            <li><Link href="/page/payment" className="hover:text-brand-600">გადახდის პირობები</Link></li>
            <li><Link href="/page/warranty" className="hover:text-brand-600">საგარანტიო მომსახურება</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">დახმარება</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/order/track" className="hover:text-brand-600">შეკვეთის სტატუსი</Link></li>
            <li><Link href="/page/returns" className="hover:text-brand-600">დაბრუნების პოლიტიკა</Link></li>
            <li><Link href="/page/privacy" className="hover:text-brand-600">კონფიდენციალურობა</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">კონტაქტი</h3>
          <ul className="space-y-2 text-sm text-muted">
            {CONTACT.phone && (
              <li><a href={`tel:${CONTACT.phone.replace(/\s+/g, "")}`} className="hover:text-brand-600">{CONTACT.phone}</a></li>
            )}
            <li><a href={`mailto:${CONTACT.email}`} className="hover:text-brand-600">{CONTACT.email}</a></li>
            <li>{CONTACT.address}</li>
            <li className="pt-2">{CONTACT.hours}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} Enex. ყველა უფლება დაცულია.
      </div>
    </footer>
  );
}
