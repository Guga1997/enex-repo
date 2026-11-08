import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // C:\Users\gnish\package-lock.json-ის გამო Next არასწორ ფესვს ირჩევდა
  outputFileTracingRoot: path.join(__dirname),
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
