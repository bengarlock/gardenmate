'use client'

import {usePathname} from 'next/navigation'
import NavBar from '@/app/NavBar'

export default function AppShell({children}) {
    const pathname = usePathname()
    const isLogin = pathname === '/login'

    if (isLogin) {
        return <div className="min-h-screen w-full">{children}</div>
    }

    return (
        <div className="min-h-screen w-full">
            <NavBar />
            <div className="min-h-screen w-full pt-32 md:pl-64 md:pt-0 lg:pl-80">
                {children}
            </div>
        </div>
    )
}
