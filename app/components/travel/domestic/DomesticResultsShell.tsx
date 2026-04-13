'use client'

import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'

export default function DomesticResultsShell() {
  return (
    <ProductsBrowseClient
      basePath="/travel/domestic"
      defaultScope="domestic"
      pageTitle="국내여행 상품"
      hidePageHeading
    />
  )
}
