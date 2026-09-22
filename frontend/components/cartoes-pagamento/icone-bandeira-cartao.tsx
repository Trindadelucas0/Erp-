'use client'

import { cn } from '@/lib/utils'
import type { CodigoBandeiraCartao } from '@/lib/bandeiras-cartao'

type Props = {
  bandeira: CodigoBandeiraCartao | string
  className?: string
  tamanho?: number
}

export function IconeBandeiraCartao({ bandeira, className, tamanho = 22 }: Props) {
  const s = tamanho
  const common = cn('inline-block shrink-0', className)

  switch (bandeira) {
    case 'visa':
      return (
        <svg
          width={s}
          height={s * 0.64}
          viewBox="0 0 48 32"
          className={common}
          aria-hidden
        >
          <rect width="48" height="32" rx="4" fill="#1A1F71" />
          <text
            x="24"
            y="21"
            textAnchor="middle"
            fill="#fff"
            fontSize="14"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
            fontStyle="italic"
          >
            VISA
          </text>
        </svg>
      )
    case 'mastercard':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40" className={common} aria-hidden>
          <circle cx="15" cy="20" r="11" fill="#EB001B" />
          <circle cx="25" cy="20" r="11" fill="#F79E1B" />
          <path
            d="M20 11.5a11 11 0 0 1 0 17 11 11 0 0 1 0-17z"
            fill="#FF5F00"
          />
        </svg>
      )
    case 'elo':
      return (
        <svg
          width={s}
          height={s * 0.64}
          viewBox="0 0 48 32"
          className={common}
          aria-hidden
        >
          <rect width="48" height="32" rx="4" fill="#000" />
          <circle cx="16" cy="16" r="7" fill="#FFCB05" />
          <circle cx="24" cy="16" r="7" fill="#00A4E0" />
          <circle cx="32" cy="16" r="7" fill="#EF4123" />
        </svg>
      )
    case 'amex':
      return (
        <svg
          width={s}
          height={s * 0.64}
          viewBox="0 0 48 32"
          className={common}
          aria-hidden
        >
          <rect width="48" height="32" rx="4" fill="#2E77BC" />
          <text
            x="24"
            y="20"
            textAnchor="middle"
            fill="#fff"
            fontSize="9"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
          >
            AMEX
          </text>
        </svg>
      )
    case 'hipercard':
      return (
        <svg
          width={s}
          height={s * 0.64}
          viewBox="0 0 48 32"
          className={common}
          aria-hidden
        >
          <rect width="48" height="32" rx="4" fill="#B3131B" />
          <text
            x="24"
            y="20"
            textAnchor="middle"
            fill="#fff"
            fontSize="8"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
          >
            HIPER
          </text>
        </svg>
      )
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground',
            className
          )}
          style={{ width: s, height: s * 0.64 }}
        >
          ?
        </span>
      )
  }
}
