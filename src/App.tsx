import { useEffect, useRef, useState } from 'react'
import { ProductGrid } from './components/ProductGrid'
import { ProductDetail } from './components/ProductDetail'
import { ProductMedia } from './components/ProductMedia'
import { config } from './config'
import { products } from './data/products'
import type { Product } from './types'
import { findProductByPath } from './product-route'
import { buildWhatsAppUrl, formatPrice } from './utils/whatsapp'

type Cart = Record<string, number>

const CART_STORAGE_KEY = 'tu-tienda-cart'

function getInitialCart(): Cart {
  try {
    const savedCart: unknown = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}')
    if (
      !savedCart
      || typeof savedCart !== 'object'
      || Array.isArray(savedCart)
      || Object.entries(savedCart).some(([id, quantity]) => (
        !products.some((product) => product.id === id)
        || !Number.isInteger(quantity)
        || quantity <= 0
      ))
    ) return {}

    return savedCart as Cart
  } catch {
    return {}
  }
}

function App() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [cart, setCart] = useState<Cart>(getInitialCart)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isCatalog = window.location.pathname === '/' || window.location.pathname === '/index.html'
  const selectedProduct = findProductByPath(window.location.pathname, products)
  const categories = ['Todos', ...new Set(products.map((product) => product.category))]
  const visibleProducts = products.filter((product) => (
    (category === 'Todos' || product.category === category)
    && product.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  ))
  const cartItems = products.flatMap((product) => {
    const quantity = cart[product.id]
    return quantity ? [{ ...product, quantity }] : []
  })
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const hasWhatsAppNumber = /^[1-9]\d{7,14}$/.test(config.whatsappNumber)

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // El carrito sigue funcionando durante esta sesión si localStorage no está disponible.
    }
  }, [cart])

  function addToCart(product: Product, quantity = 1) {
    if (!product.inStock || !Number.isSafeInteger(quantity) || quantity < 1) return
    setCart((currentCart) => ({
      ...currentCart,
      [product.id]: (currentCart[product.id] ?? 0) + quantity,
    }))
  }

  function changeQuantity(product: Product, change: number) {
    if (change > 0 && !product.inStock) return
    setCart((currentCart) => {
      const quantity = (currentCart[product.id] ?? 0) + change
      if (quantity <= 0) {
        const { [product.id]: _, ...remainingCart } = currentCart
        return remainingCart
      }
      return { ...currentCart, [product.id]: quantity }
    })
  }

  function requestWhatsAppOrder() {
    if (!cartItems.length || !hasWhatsAppNumber) return
    window.open(buildWhatsAppUrl(cartItems), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label={`${config.storeName}, inicio`}>
          <span>{config.storeName}</span>
        </a>
        <button className="cart-button" type="button" onClick={() => dialogRef.current?.showModal()}>
          <span>Carrito</span> <span aria-label={`${itemCount} productos`}>{itemCount}</span>
        </button>
      </header>

      <main id="contenido">
        {isCatalog ? (
          <section className="catalog" id="catalogo" aria-labelledby="catalog-title">
            <div className="catalog-heading">
              <h1 id="catalog-title">Productos</h1>
              <p>{visibleProducts.length} {visibleProducts.length === 1 ? 'producto' : 'productos'}</p>
            </div>
            <div className="catalog-layout">
              <div className="catalog-filters">
                <div className="catalog-controls">
                  <label htmlFor="product-search">Buscar</label>
                  <input
                    id="product-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="¿Qué estás buscando?"
                  />
                </div>
                <div className="category-chips" role="group" aria-label="Filtrar por categoría">
                  {categories.map((item) => (
                    <button
                      className={category === item ? 'category-chip category-chip--active' : 'category-chip'}
                      key={item}
                      type="button"
                      aria-pressed={category === item}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="catalog-results">
                {visibleProducts.length > 0 ? (
                  <ProductGrid products={visibleProducts} onAdd={addToCart} />
                ) : (
                  <p className="no-results" role="status">No encontramos productos con esos criterios.</p>
                )}
              </div>
            </div>
          </section>
        ) : selectedProduct ? (
          <ProductDetail product={selectedProduct} onAdd={addToCart} />
        ) : (
          <section className="not-found">
            <h1>Producto no encontrado</h1>
            <a href="/">Volver a productos</a>
          </section>
        )}
      </main>

      <dialog className="cart-dialog" ref={dialogRef} aria-labelledby="cart-title">
        <div className="cart-dialog-content">
          <header className="cart-dialog-header">
            <h2 id="cart-title">Carrito</h2>
            <form method="dialog">
              <button className="cart-close" type="submit" aria-label="Cerrar carrito">Cerrar</button>
            </form>
          </header>

          {cartItems.length ? (
            <>
              <ul className="cart-items">
                {cartItems.map((item) => (
                  <li key={item.id} className="cart-item">
                    <ProductMedia className="cart-item-image" product={item} decorative />
                    <div>
                      <h3>{item.name}</h3>
                      <p>{formatPrice(item.price)} c/u</p>
                      <p className="cart-subtotal">Subtotal: {formatPrice(item.price * item.quantity)}</p>
                    </div>
                    <div className="quantity-controls" aria-label={`Cantidad de ${item.name}`}>
                      <button type="button" onClick={() => changeQuantity(item, -1)} aria-label={`Quitar una unidad de ${item.name}`}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item, 1)} aria-label={`Agregar una unidad de ${item.name}`} disabled={!item.inStock}>+</button>
                      <button className="remove-item" type="button" onClick={() => changeQuantity(item, -item.quantity)}>Eliminar</button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="cart-total">Total estimado: {formatPrice(total)}</p>
              <p className="cart-note">El pedido queda sujeto a confirmación de stock y entrega.</p>
             </>
          ) : (
            <p className="cart-empty">Tu carrito está vacío.</p>
          )}

          <button
            className="whatsapp-button"
            type="button"
            onClick={requestWhatsAppOrder}
            disabled={!cartItems.length || !hasWhatsAppNumber}
          >
            Pedir por WhatsApp
          </button>
          {!hasWhatsAppNumber && (
            <p className="whatsapp-config" role="status">Pedidos por WhatsApp no disponibles por el momento.</p>
          )}
        </div>
      </dialog>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} {config.storeName}</p>
      </footer>
    </div>
  )
}

export default App
