import { useState, type FormEvent } from 'react'
import type { Product } from '../types'
import { formatPrice } from '../utils/whatsapp'
import { ProductMedia } from './ProductMedia'

type Props = {
  product: Product
  onAdd: (product: Product, quantity: number) => void
}

export function ProductDetail({ product, onAdd }: Props) {
  const [quantity, setQuantity] = useState(1)

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (product.inStock && Number.isSafeInteger(quantity) && quantity > 0) onAdd(product, quantity)
  }

  return (
    <section className="product-detail" aria-labelledby="product-title">
      <a className="back-link" href="/">← Volver a productos</a>
      <div className="detail-layout">
        <ProductMedia className="detail-image" product={product} />
        <div className="detail-content">
          <p className="detail-category">{product.category}</p>
          <h1 id="product-title">{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <p className="detail-description">{product.description}</p>
          {product.inStock ? (
            <form className="detail-actions" onSubmit={add}>
              <label htmlFor="detail-quantity">Cantidad</label>
              <input
                id="detail-quantity"
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
              <button className="add-button" type="submit">Agregar al carrito</button>
            </form>
          ) : (
            <p className="detail-unavailable">Sin stock</p>
          )}
        </div>
      </div>
    </section>
  )
}
