import type { Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ProvedorSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { ProvedorDeTema } from '@/components/compartilhado/provedor-de-tema'
import { LayoutCondicional } from '@/components/layout/layout-condicional'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

const scriptTemaInicial = `
(function() {
  try {
    var m = document.cookie.match(/(?:^|; )erp-tema=([^;]*)/);
    var t = m && m[1];
    if (t === 'claro') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn('font-sans', ibmPlexSans.variable, ibmPlexMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTemaInicial }} />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        <ProvedorSessaoDoUsuario>
          <ProvedorDeTema>
            <LayoutCondicional>{children}</LayoutCondicional>
          </ProvedorDeTema>
        </ProvedorSessaoDoUsuario>
      </body>
    </html>
  )
}
