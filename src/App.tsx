import { useEffect, useRef, useState } from 'react'
import { ProductGrid } from './components/ProductGrid'
import { ProductDetail } from './components/ProductDetail'
import { ProductMedia } from './components/ProductMedia'
import { AdminPage } from './components/AdminPage'
import { config } from './config'
import { fetchPublicProducts } from './data/products'
import type { Product } from './types'
import { findProductByPath } from './product-route'
import { buildWhatsAppUrl, formatPrice } from './utils/whatsapp'
import { supabase } from './lib/supabase'

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
        !id
        || typeof quantity !== 'number'
        || !Number.isSafeInteger(quantity)
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
  const [products, setProducts] = useState<Product[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error' | 'unconfigured'>('loading')
  const [cart, setCart] = useState<Cart>(getInitialCart)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isCatalog = window.location.pathname === '/' || window.location.pathname === '/index.html'
  const isAdminPath = window.location.pathname.replace(/\/+$/, '') === '/admin'
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
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const hasWhatsAppNumber = /^[1-9]\d{7,14}$/.test(config.whatsappNumber)

  async function loadCatalog() {
    if (!supabase) {
      setCatalogStatus('unconfigured')
      return
    }

    setCatalogStatus('loading')
    try {
      const loadedProducts = await fetchPublicProducts()
      const productIds = new Set(loadedProducts.map((product) => product.id))
      setProducts(loadedProducts)
      setCart((currentCart) => Object.fromEntries(
        Object.entries(currentCart).filter(([id]) => productIds.has(id)),
      ))
      setCatalogStatus('ready')
    } catch {
      setCatalogStatus('error')
    }
  }

  useEffect(() => { void loadCatalog() }, [])

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
        {isAdminPath ? (
          <nav className="site-nav" aria-label="Navegación principal"><a href="/">Volver a la tienda</a></nav>
        ) : (
          <>
            <nav className="site-nav" aria-label="Navegación principal">
              <a href="/#catalogo">Productos</a>
              <a href="/#proceso">Cómo comprar</a>
            </nav>
            <button className="cart-button" type="button" onClick={() => dialogRef.current?.showModal()}>
              <span>Carrito</span> <span aria-label={`${itemCount} productos`}>{itemCount}</span>
            </button>
          </>
        )}
      </header>

      <main id="contenido">
        {isAdminPath ? (
          <AdminPage client={supabase} />
        ) : isCatalog ? (
          <>
          <section className="store-hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="hero-kicker">Productos importados</p>
              <h1 id="hero-title">Encontrá lo que buscás.</h1>
              <p>Explorá productos, revisá el total y coordiná stock y entrega directamente por WhatsApp.</p>
              <a className="hero-cta" href="#catalogo">Explorar productos</a>
            </div>
            <section className="order-steps" id="proceso" aria-labelledby="steps-title">
              <h2 id="steps-title">Así funciona tu pedido</h2>
              <ol>
                <li><span>01</span><div><strong>Elegí</strong><small>Explorá productos y precios.</small></div></li>
                <li><span>02</span><div><strong>Revisá</strong><small>Controlá cantidades y total estimado.</small></div></li>
                <li><span>03</span><div><strong>Confirmá</strong><small>Coordiná stock y entrega por WhatsApp.</small></div></li>
              </ol>
            </section>
          </section>
          <p className="purchase-transparency">
            {hasWhatsAppNumber ? (
              <><strong>Sin pago en esta web.</strong> No ingresás datos de tarjeta; el negocio confirma stock y entrega por WhatsApp.</>
            ) : (
              <><strong>Pedidos por WhatsApp no disponibles todavía.</strong> Falta configurar el número del negocio.</>
            )}
          </p>
          <section className="catalog" id="catalogo" aria-labelledby="catalog-title">
            <div className="catalog-heading">
              <h1 id="catalog-title">Productos</h1>
              <p>{catalogStatus === 'ready' ? `${visibleProducts.length} ${visibleProducts.length === 1 ? 'producto' : 'productos'}` : ''}</p>
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
                {catalogStatus === 'loading' ? (
                  <p className="catalog-message" role="status">Cargando productos…</p>
                ) : catalogStatus === 'unconfigured' ? (
                  <p className="catalog-message" role="status">El catálogo todavía se está preparando. Volvé a consultar pronto.</p>
                ) : catalogStatus === 'error' ? (
                  <div className="catalog-message" role="alert">
                    <p>No se pudo cargar el catálogo.</p>
                    <button className="add-button" type="button" onClick={() => void loadCatalog()}>Reintentar</button>
                  </div>
                ) : visibleProducts.length > 0 ? (
                  <ProductGrid products={visibleProducts} onAdd={addToCart} />
                ) : (
                  <p className="no-results" role="status">No encontramos productos con esos criterios.</p>
                )}
              </div>
            </div>
          </section>
          </>
        ) : catalogStatus === 'loading' ? (
          <p className="catalog-message" role="status">Cargando producto…</p>
        ) : catalogStatus === 'unconfigured' ? (
          <section className="not-found"><h1>Catálogo sin configurar</h1><a href="/">Volver</a></section>
        ) : catalogStatus === 'error' ? (
          <section className="not-found"><h1>No se pudo cargar el producto</h1><a href="/">Volver a productos</a></section>
        ) : selectedProduct ? (
          <ProductDetail product={selectedProduct} onAdd={addToCart} />
        ) : (
          <section className="not-found">
            <h1>Producto no encontrado</h1>
            <a href="/">Volver a productos</a>
          </section>
        )}
      </main>

      {!isAdminPath && <dialog className="cart-dialog" ref={dialogRef} aria-labelledby="cart-title">
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
      </dialog>}

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} {config.storeName}</p>
      </footer>
    </div>
  )
}

export default App
