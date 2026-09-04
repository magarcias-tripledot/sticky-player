import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sticky Level Authoring",
  description: "Author Sticky placements JSON in a 3D viewport.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
