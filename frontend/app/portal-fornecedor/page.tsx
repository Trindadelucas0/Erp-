'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaPortalFornecedor() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/portal-fornecedor/login')
  }, [router])

  return null
}
