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
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
