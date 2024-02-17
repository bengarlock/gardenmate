'use client';

import NavBar from "@/app/NavBar";
import {globalStore} from "@/app/globalstore";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import Plants from "@/app/plants/page";


export default function Home() {
    const pathname = usePathname()

    return (
        <div>
                home
        </div>

    );
}
