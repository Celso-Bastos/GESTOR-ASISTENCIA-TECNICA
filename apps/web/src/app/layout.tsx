import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistencia Tecnica",
  description: "MVP para gerenciamento de assistencia tecnica de celulares"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
