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
        <div className={"flex flex-row w-full"}>
            <NavBar />
            {children}
        </div>
        </body>
        </html>
    );
}
