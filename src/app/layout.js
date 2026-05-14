import {Inter} from "next/font/google";
import "./globals.css";
import NavBar from "@/app/NavBar";

const inter = Inter({subsets: ["latin"]});

export const metadata = {
    title: "GardenMate",
    description: "Tools to make things things grow",
};

export default function RootLayout({children}) {

    return (
        <html lang="en">
        <body className={inter.className}>
        <div className="min-h-screen w-full">
            <NavBar />
            <div className="min-h-screen w-full pt-32 md:pl-64 md:pt-0 lg:pl-80">
                {children}
            </div>
        </div>
        </body>
        </html>
    );
}
