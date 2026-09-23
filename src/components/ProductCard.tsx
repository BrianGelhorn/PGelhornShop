import type { Product } from '../types'
import { formatPrice } from '../utils/whatsapp'
import { ProductMedia } from './ProductMedia'

type ProductCardProps = {
  product: Product
  onAdd: (product: Product) => void
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <article className="product-card">
      <ProductMedia className="product-image" product={product} />
      <div className="product-details">
        <h3><a className="product-link" href={`/producto/${encodeURIComponent(product.id)}`}>{product.name}</a></h3>
        <div className="product-footer">
          <p className="product-price">{formatPrice(product.price)}</p>
          {product.inStock ? (
            <button className="add-button" type="button" aria-label={`Agregar ${product.name} al carrito`} onClick={() => onAdd(product)}>Agregar</button>
          ) : (
            <button className="add-button" type="button" disabled>Sin stock</button>
          )}
        </div>
      </div>
    </article>
  )
}
