'use client'

import { useEffect, useState } from 'react'

export function useProductIdFromParams(params: Promise<{ id: string }> | { id: string }): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    void Promise.resolve(params).then((p) => setId(p.id))
  }, [params])
  return id
}
