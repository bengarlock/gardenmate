import {Inter} from "next/font/google";
import "./globals.css";
import AppShell from "@/app/AppShell";

const inter = Inter({subsets: ["latin"]});

export const metadata = {
    title: "GardenMate",
    description: "Tools to make things things grow",
};

export default function RootLayout({children}) {

    return (
        <html lang="en">
        <body className={inter.className}>
        <AppShell>{children}</AppShell>
        </body>
        </html>
    );
}
