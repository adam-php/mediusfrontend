import './globals.css'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import RouteLoader from '@/components/RouteLoader'
import Footer from '@/components/Footer'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Medius',
  description: 'Secure peer-to-peer middleman platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <RouteLoader />
        <Script id="ref-capture" strategy="afterInteractive">{`
          try {
            var url = new URL(window.location.href);
            var ref = url.searchParams.get('ref');
            if (ref) {
              localStorage.setItem('medius_ref_code', ref);
            }
          } catch (e) {}
        `}</Script>
        <Navbar />
        <main className="min-h-screen">
           <Suspense fallback={
             <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 relative overflow-hidden flex items-center justify-center">
               <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-orange-600/10" />
               <div className="flex items-center space-x-3 text-white relative z-10">
                 <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-lg">Loading...</span>
               </div>
             </div>
           }>
             {children}
           </Suspense>
         </main>
        <Footer />
      </body>
    </html>
  )
}