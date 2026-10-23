import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * მენიუს ქვეჯგუფის ხატულა — ხაზოვანი, 24×24, ზოლის ხატულების სტილში.
 *
 * ანიმაცია CSS-ითაა (globals.css → .cat-ico): მენიუს გახსნისას ხაზები რიგრიგობით
 * „ეხატება“, მაუსის მიტანაზე — თავიდან. ამისთვის თითო ფიგურას pathLength=1
 * ეწერება, რომ ნებისმიერი სიგრძის ხაზი ერთნაირად დაიხატოს.
 *
 * ხატულა slug-ით ირჩევა; ახალ კატეგორიას სახელით ეძებნება ყველაზე ახლო.
 */

const I: Record<string, ReactNode> = {
  ac: (
    <>
      <rect x="2.5" y="4.5" width="19" height="8" rx="2" />
      <path d="M6 9.5h12" />
      <path d="M8 15.5q-1.2 2 0 4.5M12 15.5v4.5M16 15.5q1.2 2 0 4.5" />
    </>
  ),
  solar: (
    <>
      <circle cx="18.5" cy="4.5" r="2" />
      <path d="M18.5 1v.5M22 4.5h-.5M21 2l-.4.4M16 2l.4.4" />
      <path d="M4.5 10h11l2.5 8h-16z" />
      <path d="M3.2 14h13.6M8.8 10l-.6 8M12.2 10l.6 8" />
      <path d="M10 18v3M7.5 21.5h5" />
    </>
  ),
  generator: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11.5" rx="1.5" />
      <path d="M4.5 18v2M19.5 18v2M6 6.5V4h2.5" />
      <circle cx="8" cy="12.25" r="2.75" />
      <rect x="13" y="9.5" width="5.5" height="3" rx=".5" />
      <path d="M16.2 13.8l-1 1.7h1.6l-1 1.7" />
    </>
  ),
  powerstation: (
    <>
      <rect x="3.5" y="7" width="17" height="13.5" rx="2.5" />
      <path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M12.8 10.2 10.3 14h3.2l-2.4 3.8" />
    </>
  ),
  ups: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <rect x="8.5" y="5" width="7" height="3.5" rx=".6" />
      <path d="M9 12h1M11.5 12h1M14 12h1M9 16h6M9 18.5h6" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M5.5 7V4.5h3V7M15.5 7V4.5h3V7" />
      <path d="M5.5 12h3M7 10.5v3M15.5 12h3" />
      <path d="M12.6 13l-1.4 2.4h1.8L11.6 18" />
    </>
  ),
  protection: (
    <>
      <path d="M12 2.5 4.5 5.5v6c0 4.7 3.1 8.6 7.5 10 4.4-1.4 7.5-5.3 7.5-10v-6z" />
      <path d="M12.9 7.5 9.8 12.6h3.3l-1.2 4.4 3.3-5.5h-3.3z" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="4" width="15" height="10.5" rx="1.5" />
      <path d="M3 19 4.5 14.5h15L21 19z" />
      <path d="M10.5 17h3" />
    </>
  ),
  peripherals: (
    <>
      <rect x="2" y="9.5" width="14" height="9" rx="1.5" />
      <path d="M4.8 12.5h1M7.8 12.5h1M10.8 12.5h1M13 12.5h.5M4.8 15.5h8.5" />
      <rect x="17.5" y="8.5" width="4.5" height="8" rx="2.25" />
      <path d="M19.75 8.5v2.5M19.75 8.5c0-2.5-1.5-4-4-4h-2" />
    </>
  ),
  software: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M2.5 8h19M5 6h.5M7 6h.5" />
      <path d="m9 11.5-2.5 2.5L9 16.5M15 11.5l2.5 2.5-2.5 2.5M13 11l-2 6" />
    </>
  ),
  alarm: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
      <path d="M3 7a9 9 0 0 1 2.5-3.5M21 7a9 9 0 0 0-2.5-3.5" />
    </>
  ),
  cctv: (
    <>
      <path d="M3 5h18" />
      <path d="M4.5 5v2.5a7.5 7.5 0 0 0 15 0V5" />
      <circle cx="12" cy="11" r="2.75" />
      <circle cx="12" cy="11" r="1" />
      <path d="M8 19.5h8" />
    </>
  ),
  firephone: (
    <>
      <path d="M8.5 3.5 6 3c-1.4.2-2.5 1.4-2.4 2.9.6 7.4 7.1 13.9 14.5 14.5 1.5.1 2.7-1 2.9-2.4l-.5-2.5-3.8-1.6-1.9 1.9a11 11 0 0 1-5.6-5.6l1.9-1.9z" />
      <path d="M15 3.5a5.5 5.5 0 0 1 5.5 5.5M15 7a2 2 0 0 1 2 2" />
    </>
  ),
  pa: (
    <>
      <path d="M3.5 10v4h3l7 4.5v-13l-7 4.5z" />
      <path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11" />
      <path d="M6.5 14l1 5h2.5l-.9-4.2" />
    </>
  ),
  fire: (
    <>
      <path d="M9 6.5V4h6v2.5" />
      <path d="M3.5 6.5h17" />
      <path d="M4.5 6.5c0 2.6 3.4 4.5 7.5 4.5s7.5-1.9 7.5-4.5" />
      <path d="M8 14c-.8 1 .8 2 0 3s.8 2 0 3M12 14c-.8 1 .8 2 0 3s.8 2 0 3M16 14c-.8 1 .8 2 0 3s.8 2 0 3" />
    </>
  ),
  speaker: (
    <>
      <circle cx="10.5" cy="12" r="7.5" />
      <circle cx="10.5" cy="12" r="3" />
      <path d="M20 9a4.5 4.5 0 0 1 0 6M22 7a7.5 7.5 0 0 1 0 10" />
    </>
  ),
  access: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <circle cx="12" cy="6.5" r="1.5" />
      <path d="M9.5 10.5h5M9.5 12.5h5" />
      <circle cx="12" cy="17" r="1.75" />
    </>
  ),
  hdd: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <circle cx="12" cy="10" r="5" />
      <circle cx="12" cy="10" r="1" />
      <path d="M16.5 18.5 13.2 12" />
    </>
  ),
  switch: (
    <>
      <rect x="2" y="8" width="20" height="8.5" rx="1.5" />
      <path d="M5 13.5v-2h2.2v2M9 13.5v-2h2.2v2M13 13.5v-2h2.2v2" />
      <path d="M18 11.2h1.5M18 13.5h1.5" />
    </>
  ),
  controller: (
    <>
      <rect x="4" y="13" width="16" height="7" rx="2" />
      <path d="M7.5 16.5h1.5M13 16.5h3.5" />
      <path d="M8.5 10a3 3 0 0 1 .4-6 4 4 0 0 1 7.4 1.2A2.5 2.5 0 0 1 16 10z" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 9a14 14 0 0 1 19 0" />
      <path d="M5.5 12.5a9.5 9.5 0 0 1 13 0" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19.5" r="1" />
    </>
  ),
  netacc: (
    <>
      <path d="M8 3.5h8v8l-1.5 2h-5L8 11.5z" />
      <path d="M10 3.5V6M12 3.5V6M14 3.5V6" />
      <path d="M12 13.5v3.5a3.5 3.5 0 0 0 3.5 3.5H19" />
    </>
  ),
  netpsu: (
    <>
      <rect x="4.5" y="7" width="11" height="10" rx="2" />
      <path d="M8 7V4M12 7V4" />
      <path d="M15.5 12h2.5a2 2 0 0 1 2 2v6.5" />
      <path d="M10.6 9.5 9 12.3h2.2l-1.5 2.7" />
    </>
  ),
  netsoft: (
    <>
      <path d="M7 18.5a4.5 4.5 0 0 1-.7-8.9A6 6 0 0 1 17.8 8a4.5 4.5 0 0 1 .2 10.5z" />
      <path d="m10 11.8-1.6 1.7 1.6 1.7M14 11.8l1.6 1.7-1.6 1.7" />
    </>
  ),
  router: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 10V5.5M10 7.5l2-2 2 2" />
      <path d="M12 14v4.5M10 16.5l2 2 2-2" />
      <path d="M10 12H5.5M7.5 10l-2 2 2 2" />
      <path d="M14 12h4.5M16.5 10l2 2-2 2" />
    </>
  ),
  industrial: (
    <>
      <path d="M2 8.5h20M2 15.5h20" />
      <rect x="6.5" y="3" width="11" height="18" rx="1.5" />
      <path d="M9 6h6M9 18h1.5M13.5 18H15" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  towerwifi: (
    <>
      <path d="M12 8.5 7.5 21.5M12 8.5l4.5 13.5M9.4 16h5.2M8.3 19h7.4" />
      <circle cx="12" cy="6.5" r="1.5" />
      <path d="M8.5 3.5a5 5 0 0 0 0 6M15.5 3.5a5 5 0 0 1 0 6M6 1.5a8.5 8.5 0 0 0 0 10M18 1.5a8.5 8.5 0 0 1 0 10" />
    </>
  ),
  backhaul: (
    <>
      <path d="M4.5 8.5a8 8 0 0 0 11 11z" />
      <path d="M10 14l3.5-3.5" />
      <circle cx="14.25" cy="9.75" r="1" />
      <path d="M16.5 5a4 4 0 0 1 2.5 2.5M17.5 2a7 7 0 0 1 4.5 4.5" />
      <path d="M8.5 17.5 6.5 22h5" />
    </>
  ),
  rack: (
    <>
      <rect x="5" y="2.5" width="14" height="18" rx="1.5" />
      <path d="M5 7h14M5 11.5h14M5 16h14" />
      <path d="M7.5 4.75h3M7.5 9.25h3M7.5 13.75h3M15 9.25h1.5M15 13.75h1.5" />
      <path d="M7 20.5v1.5M17 20.5v1.5" />
    </>
  ),
  lancable: (
    <>
      <path d="M15 2.5h5v6.5l-1 1.5h-3l-1-1.5z" />
      <path d="M16.5 2.5v2M18.5 2.5v2" />
      <path d="M17.5 10.5v3a6 6 0 0 1-6 6H8a3.5 3.5 0 0 1 0-7h4.5" />
    </>
  ),
  lancomp: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M9 9h6v5.5h-1.5V16h-3v-1.5H9z" />
      <path d="M10.75 9v1.5M13.25 9v1.5" />
    </>
  ),
  lantools: (
    <>
      <path d="M9.5 11c-1.6-3-1.1-6 1-7.5M14.5 11c1.6-3 1.1-6-1-7.5" />
      <circle cx="12" cy="11.5" r="1.5" />
      <path d="M10.8 12.6 7 21.5M13.2 12.6l3.8 8.9" />
    </>
  ),
  mediaconv: (
    <>
      <rect x="2.5" y="9" width="19" height="9.5" rx="1.5" />
      <rect x="5" y="12" width="4" height="3.5" rx=".5" />
      <path d="M14 12.5h5M14 15h5" />
      <path d="M7 5.5h10M14.5 3.5l2.5 2-2.5 2" />
    </>
  ),
  opticcomp: (
    <>
      <rect x="8" y="2.5" width="8" height="7" rx="1" />
      <path d="M9 9.5v4.5h6V9.5M12 14v7.5" />
      <path d="M10.5 5h3" />
    </>
  ),
  sfp: (
    <>
      <rect x="2.5" y="9" width="13.5" height="6" rx=".8" />
      <path d="M16 10h3.5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H16" />
      <path d="M5.5 12h5M20.5 12h1.5" />
    </>
  ),
  pon: (
    <>
      <circle cx="12" cy="9.5" r="6.5" />
      <path d="M5.5 9.5h13" />
      <path d="M12 3c2 1.8 3 4 3 6.5s-1 4.7-3 6.5c-2-1.8-3-4-3-6.5S10 4.8 12 3z" />
      <path d="M12 16v3M7.5 21.5h9M12 19l-3 2.5M12 19l3 2.5" />
    </>
  ),
  fibercable: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="6.5" r="1.5" />
      <circle cx="16.8" cy="14.75" r="1.5" />
      <circle cx="7.2" cy="14.75" r="1.5" />
    </>
  ),
  clamp: (
    <>
      <circle cx="9" cy="15" r="5.5" />
      <circle cx="9" cy="15" r="2" />
      <path d="M14.5 15V5a1.5 1.5 0 0 1 1.5-1.5h4V9h-5.5" />
      <circle cx="17.5" cy="6.25" r=".9" />
    </>
  ),
  passive: (
    <>
      <rect x="3" y="6.5" width="18" height="10" rx="1.5" />
      <rect x="5.75" y="9.25" width="4.5" height="4.5" rx=".6" />
      <rect x="13.75" y="9.25" width="4.5" height="4.5" rx=".6" />
      <path d="M7 16.5v3.5M17 16.5v3.5" />
    </>
  ),
  splicer: (
    <>
      <path d="M3 13.5h18V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M6 13.5 8 4h10l-1.5 9.5" />
      <path d="M9.6 6.5h5.9l-.9 4.5H8.8z" />
      <path d="M6 17.5h4M14.5 17.5h3" />
    </>
  ),
  meter: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <rect x="8.5" y="5" width="7" height="5" rx=".8" />
      <path d="M9 13.5h2M13 13.5h2M9 16.5h2M13 16.5h2M10.5 7.5l1.5-1 1 2 1.5-1.5" />
    </>
  ),
  optictools: (
    <>
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="M8.3 16.2 16 4.5M15.7 16.2 8 4.5" />
    </>
  ),
  smartlock: (
    <>
      <rect x="6.5" y="2.5" width="9" height="19" rx="2" />
      <path d="M9 6h1M12 6h1M9 8.5h1M12 8.5h1" />
      <circle cx="11" cy="14.5" r="1.5" />
      <path d="M12.5 14.5H20" />
    </>
  ),
  hotelaccess: (
    <>
      <rect x="3.5" y="3" width="9" height="18" rx="2" />
      <path d="M6.5 16.5h3" />
      <path d="M6.5 9.5a2.5 2.5 0 0 1 3 0M5.5 7.5a4.5 4.5 0 0 1 5 0" />
      <path d="M15.5 9a5 5 0 0 1 0 6M18 6.5a8.5 8.5 0 0 1 0 11" />
    </>
  ),
  safe: (
    <>
      <rect x="3" y="3.5" width="18" height="15.5" rx="2" />
      <rect x="5.5" y="6" width="13" height="10.5" rx="1" />
      <circle cx="12" cy="11.25" r="2.5" />
      <path d="M12 8.75v1M14.5 11.25h-1M6 19v1.5M18 19v1.5" />
    </>
  ),
  minibar: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <path d="M5 9h14M8 5.25v1.5M8 12v3" />
      <path d="M14 19v-4.2l.9-1.3v-1.8h1.2v1.8l.9 1.3V19z" />
    </>
  ),
  energysaver: (
    <>
      <rect x="4" y="4" width="16" height="16.5" rx="2.5" />
      <path d="M9 10V2h6v8M7.5 10h9" />
      <path d="M12.8 12.5l-1.8 3h2.2l-1.4 2.7" />
    </>
  ),
  locker: (
    <>
      <rect x="3" y="2.5" width="18" height="19" rx="1.5" />
      <path d="M9 2.5v19M15 2.5v19" />
      <path d="M5 5.5h2M11 5.5h2M17 5.5h2M5 13h2M11 13h2M17 13h2" />
    </>
  ),
  cards: (
    <>
      <rect x="2.5" y="4.5" width="13" height="9" rx="1.5" />
      <rect x="5" y="7" width="3" height="2.5" rx=".4" />
      <circle cx="16.5" cy="15.5" r="5" />
      <circle cx="16.5" cy="15.5" r="2.25" />
    </>
  ),
  hotelsoft: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M12 16.5v4M8.5 20.5h7" />
      <path d="M6 13.5V9M6 11.5h12v2M18 11.5v-1a1.5 1.5 0 0 0-1.5-1.5H11v2.5M7.5 10.25h2" />
    </>
  ),
  voip: (
    <>
      <rect x="2.5" y="9.5" width="19" height="11" rx="1.5" />
      <path d="M4.5 9.5V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v4.5" />
      <rect x="12" y="12" width="7" height="3" rx=".5" />
      <path d="M12 17.5h1.5M15 17.5h1.5M18 17.5h1M5 13v4.5" />
    </>
  ),
  whiteboard: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="1.5" />
      <path d="M7 16.5 5 21.5M17 16.5l2 5" />
      <path d="M6 12.5c2-3 4 1 6-2s3-1 6-3.5" />
    </>
  ),
  projector: (
    <>
      <rect x="2.5" y="9.5" width="19" height="8" rx="2" />
      <circle cx="8" cy="13.5" r="2.5" />
      <path d="M13.5 12.5h5M13.5 14.5h5M5.5 17.5V19M18.5 17.5V19" />
      <path d="M6 7 4.5 4M8 6.5V3.5M10 7l1.5-3" />
    </>
  ),
  conference: (
    <>
      <rect x="2.5" y="3" width="19" height="13" rx="1.5" />
      <circle cx="7.5" cy="8" r="1.3" />
      <circle cx="12" cy="8" r="1.3" />
      <circle cx="16.5" cy="8" r="1.3" />
      <path d="M5.5 12.5a2 2 0 0 1 4 0M10 12.5a2 2 0 0 1 4 0M14.5 12.5a2 2 0 0 1 4 0" />
      <path d="M12 16v4.5M9 20.5h6" />
    </>
  ),
  touchscreen: (
    <>
      <rect x="2.5" y="3" width="19" height="12.5" rx="1.5" />
      <path d="M12 15.5v3M8.5 21h7" />
      <circle cx="12" cy="9.25" r="1.3" />
      <path d="M8.75 9.25a3.25 3.25 0 0 1 6.5 0M6.5 9.25a5.5 5.5 0 0 1 11 0" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="1.5" />
      <path d="M12 16.5v4M8 20.5h8" />
      <path d="M6 13h4" />
    </>
  ),
  nas: (
    <>
      <rect x="3.5" y="3" width="17" height="18" rx="2" />
      <rect x="7.5" y="6" width="2.5" height="12" rx=".6" />
      <rect x="11.25" y="6" width="2.5" height="12" rx=".6" />
      <rect x="15" y="6" width="2.5" height="12" rx=".6" />
      <path d="M5.5 6.5v2" />
    </>
  ),
  usb: (
    <>
      <rect x="7.5" y="8" width="9" height="13.5" rx="2" />
      <path d="M9.5 8V3h5v5M11 5v1M13 5v1" />
      <path d="M10.5 17.5h3" />
    </>
  ),
  ssd: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="7" y="8" width="10" height="8" rx="1" />
      <path d="M9 11h6M9 13h3.5" />
      <circle cx="5.25" cy="6.25" r=".6" />
      <circle cx="18.75" cy="17.75" r=".6" />
    </>
  ),
  sdcard: (
    <>
      <path d="M7 2.5h7.5l4 4v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z" />
      <path d="M8.5 5.5V8M11 5.5V8M13.5 5.5V8" />
      <path d="M8.5 15.5h7" />
    </>
  ),
  box: (
    <>
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" />
      <path d="M3 7l9 4.5L21 7M12 11.5V21" />
    </>
  ),
};

/** slug → ხატულა. ახალი კატეგორია სახელით ჩერდება ქვემოთ, FALLBACKS-ზე */
const BY_SLUG: Record<string, string> = {
  "industriuli-konditsionerebi": "ac",
  "mzis-energia": "solar",
  "dizelis-generatorebi": "generator",
  "portatuli-elsadgurebi": "powerstation",
  "portatuli-elsadguris-aqsesuarebi": "powerstation",
  "uwyveti-kvebis-wyaroebi-ups": "ups",
  akumulatorebi: "battery",
  "eleqtrodamcavi-mowyobilobebi": "protection",
  "kompiuterebi-da-leptopebi": "laptop",
  periferia: "peripherals",
  "programuli-uzrunvelyofa": "software",
  "datsviti-signalizatsia": "alarm",
  "video-metvalyureoba": "cctv",
  "mekhandzris-telefonia": "firephone",
  "sajaro-mauwyeblobis-da-evakuatsiis-sistema": "pa",
  "sakhandzro-signalizacia": "fire",
  "gakhmovanebis-sistemebi": "speaker",
  "dashvebis-sistema": "access",
  "myari-diskebi": "hdd",
  svichebi: "switch",
  "svichebi-lan": "switch",
  kontrolerebi: "controller",
  "korporatiuli-wifi": "wifi",
  "qselis-aqsesuarebi": "netacc",
  "qselis-kvebis-blokebi": "netpsu",
  "qselis-programuli-uzrunvelyofa": "netsoft",
  "routerebi-da-firewall-ebi": "router",
  "industriuli-qseluri-mowyobilobebi": "industrial",
  "saprovaidero-wifi": "towerwifi",
  "magistraluri-usadeno-qselebi": "backhaul",
  "sakomunikacio-karadebi": "rack",
  "lan-kabelebi": "lancable",
  "lan-komponentebi": "lancomp",
  "lan-instrumentebi": "lantools",
  "media-konvertorebi": "mediaconv",
  "optikuri-komponentebi": "opticcomp",
  "sfp-modulebi": "sfp",
  "gepon-epon": "pon",
  "optikuri-kabelebi": "fibercable",
  "kabelis-samagrebi": "clamp",
  "pasiuri-komponentebi": "passive",
  "shedughebis-aparatebi-da-aqsesuarebi": "splicer",
  "sazomi-mowyobilobebi": "meter",
  "optikis-instrumentebi": "optictools",
  "eleqtronuli-saketebi": "smartlock",
  "saketebis-aqsesuarebi": "smartlock",
  "dashvebis-kontroli-sastumro": "hotelaccess",
  seifebi: "safe",
  minibarebi: "minibar",
  energoseiverebi: "energysaver",
  "eleqtronuli-lokerebi": "locker",
  "baratebi-da-samajurebi": "cards",
  "sastumros-programuli-uzrunvelyofa": "hotelsoft",
  voip: "voip",
  "interaqtiuli-dafebi": "whiteboard",
  proeqtorebi: "projector",
  "sakonferencio-sistemebi": "conference",
  "interaqtiuli-ekranebi": "touchscreen",
  monitorebi: "monitor",
  "nas-serverebi": "nas",
  "usb-mekhsiereba": "usb",
  "myari-diskebi-shenakhva": "hdd",
  "ssd-diskebi": "ssd",
  "sd-baratebi": "sdcard",
};

const FALLBACKS: [RegExp, string][] = [
  [/კამერ|ვიდეო-მეთ|cctv/, "cctv"],
  [/სვიჩ|switch/, "switch"],
  [/როუტერ|router|firewall/, "router"],
  [/wifi|უსადენო/, "wifi"],
  [/კაბელ|cable/, "lancable"],
  [/აკუმულ|battery/, "battery"],
  [/ups|უწყვეტ/, "ups"],
  [/ssd/, "ssd"],
  [/დისკ|hdd/, "hdd"],
  [/მონიტორ|ეკრან/, "monitor"],
  [/ტელეფონ|voip/, "voip"],
  [/საკეტ|lock/, "smartlock"],
  [/სერვერ|nas/, "nas"],
  [/პროგრამ|software/, "software"],
  [/სიგნალიზ|დეტექტ/, "alarm"],
  [/გახმოვან|დინამიკ|ხმა/, "speaker"],
  [/მზის|solar/, "solar"],
  [/ოპტიკ|ბოჭკ/, "fibercable"],
];

export function subcategoryIconKey(name: string, slug: string): string {
  if (BY_SLUG[slug]) return BY_SLUG[slug];
  const s = `${name} ${slug}`.toLowerCase();
  return FALLBACKS.find(([re]) => re.test(s))?.[1] ?? "box";
}

/** თითო ფიგურას pathLength=1 — ხატვის ანიმაცია ყველა ხაზზე ერთ დროში სრულდება */
function measured(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ children?: ReactNode }>;
    if (el.type === Fragment) return measured(el.props.children);
    return cloneElement(el as ReactElement<{ pathLength?: number }>, { pathLength: 1 });
  });
}

export default function SubcategoryIcon({
  name,
  slug,
  className = "",
  delayMs = 0,
}: {
  name: string;
  slug: string;
  className?: string;
  /** მენიუს გახსნისას რიგრიგობით დახატვისთვის */
  delayMs?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`cat-ico ${className}`}
      style={{ "--d": `${delayMs}ms` } as React.CSSProperties}
      aria-hidden
    >
      {measured(I[subcategoryIconKey(name, slug)])}
    </svg>
  );
}
