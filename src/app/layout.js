import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "DalseShop",
  description: "Tu tienda en línea",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
