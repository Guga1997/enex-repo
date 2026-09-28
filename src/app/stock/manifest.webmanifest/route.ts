import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * PWA-ს მანიფესტი — ტელეფონზე დაყენებისთვის და APK-ში შესაფუთად (TWA).
 * ცალკე აპლიკაციაა, ამიტომ start_url და scope /stock-ზეა შეზღუდული.
 */
export function GET() {
  return NextResponse.json({
    name: "Enex საწყობი — კომპონენტები",
    short_name: "Enex საწყობი",
    description: "კომპიუტერის კომპონენტების ნაშთი, ფასი და ახალი პოზიციები.",
    start_url: "/stock",
    scope: "/stock",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1218",
    theme_color: "#009cd1",
    lang: "ka",
    icons: [
      { src: "/brand/enex-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/enex-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/enex-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}
