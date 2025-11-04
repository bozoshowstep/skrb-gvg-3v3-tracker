export const metadata = {
  title: "Seven Knights Rebirth — GvG 3v3 Tracker",
  description: "Local-only GvG 3v3 tracker with search & stats",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";
