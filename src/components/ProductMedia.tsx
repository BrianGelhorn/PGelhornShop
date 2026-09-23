import { useState } from 'react'
import type { Product } from '../types'

type Props = {
  product: Product
  className: string
  decorative?: boolean
}

export function ProductMedia({ product, className, decorative = false }: Props) {
  const [failed, setFailed] = useState(false)

  if (product.image.includes('placehold.co/') || failed) {
    return (
      <div
        className={`${className} media-placeholder`}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : `Foto pendiente de ${product.name}`}
        aria-hidden={decorative || undefined}
      >
        <span className="media-placeholder-icon" aria-hidden="true" />
        <span>Foto pendiente</span>
      </div>
    )
  }

  return (
    <img
      className={className}
      src={product.image}
      alt={decorative ? '' : product.description}
      loading={className === 'product-image' ? 'lazy' : undefined}
      onError={() => setFailed(true)}
    />
  )
}
