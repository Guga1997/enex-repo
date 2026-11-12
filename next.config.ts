import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // C:\Users\gnish\package-lock.json-ის გამო Next არასწორ ფესვს ირჩევდა
  outputFileTracingRoot: path.join(__dirname),
  // `next start -H 127.0.0.1`-ით Next-ის router-ი მისამართს 127.0.0.1:3000-ით აგებს, middleware
  // კი localhost:3000-ით — ენის rewrite (/en, /ru) და შესვლაზე გადამისამართება „გარე“ ჰოსტად
  // ითვლებოდა: /en → 500, /account → https://localhost:3000/login. ამ პარამეტრით middleware
  // იმავე საწყის მისამართს იღებს, რასაც router-ი, და ორივე ისევ შიდა გადასვლაა.
  skipMiddlewareUrlNormalize: true,
  // სტატიკური ხელსაწყოები public/tools-იდან — სუფთა მისამართით
  async rewrites() {
    return [{ source: "/bluetti", destination: "/tools/bluetti.html" }];
  },
  images: {
    // ნებისმიერი ჰოსტი: უცნობ ჰოსტზე next/image მთელ გვერდს 500-ით აგდებს. ღია proxy-ს
    // ხურავს nginx — /_next/image გარე url-ს მხოლოდ მიმწოდებლების ჰოსტებიდან უშვებს
    // (deploy/nginx-enex.conf, "image proxy allowlist").
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // ფოტოების cache nginx-შია (/etc/nginx/conf.d/enex-image-cache.conf). Next-ის disk cache
    // restart-ის შემდეგ ყველა ფაილს კითხულობდა (70 000 ფაილი) და ფოტოები ~70 წამი ჭედავდა.
    maximumDiskCacheSize: 0,
  },
};

export default nextConfig;
