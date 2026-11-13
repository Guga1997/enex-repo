/** ჩატის ბუშტი ყურმილით — ფერს ტექსტის ფერიდან იღებს (currentColor) */
export default function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 7.8c-.5.5-.7 1.3-.4 2.2.7 2 2.3 3.8 4.4 4.7.9.4 1.8.2 2.4-.3l.4-.5c.2-.3.1-.7-.2-.9l-1.4-.9c-.3-.2-.6-.1-.8.1l-.5.5c-.9-.4-1.9-1.4-2.4-2.4l.5-.5c.2-.2.3-.5.1-.8l-.8-1.4c-.2-.3-.6-.4-.9-.2z"
        fill="currentColor"
      />
    </svg>
  );
}
