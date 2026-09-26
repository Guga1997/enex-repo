"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { withLocale } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

/**
 * next/link-ის შემცვლელი: შიდა ბმულს მიმდინარე ენის პრეფიქსს ადებს
 * (/catalog → /en/catalog). ქართულზე მისამართი უცვლელი რჩება.
 * გარე ბმული, mailto:, tel: და #ღუზა ხელუხლებელი გადის.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const h = typeof href === "string" && href.startsWith("/") ? withLocale(href, locale) : href;
  return <NextLink href={h} {...rest} />;
}
