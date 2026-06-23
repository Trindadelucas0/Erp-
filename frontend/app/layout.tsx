import { Manrope } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ProvedorSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { ProvedorDeTema } from '@/components/compartilhado/provedor-de-tema'
import { LayoutCondicional } from '@/components/layout/layout-condicional'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })

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
    <html lang="pt-BR" suppressHydrationWarning className={cn('font-sans', manrope.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTemaInicial }} />
      </head>
      <body>
        <ProvedorSessaoDoUsuario>
          <ProvedorDeTema>
            <LayoutCondicional>{children}</LayoutCondicional>
          </ProvedorDeTema>
        </ProvedorSessaoDoUsuario>
      </body>
    </html>
  )
}
