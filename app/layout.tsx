import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NomNom — Chat about your food",
  description:
    "Upload a photo of your meal to get an FDA-style nutrition label and chat about it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
