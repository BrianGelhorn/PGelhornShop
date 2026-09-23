# UML - Página de producto

Al seleccionar un producto, el navegador abre una URL `/producto/:id`. La tienda usa enlaces normales y resuelve la ruta en `App`, sin librería de router. El carrito persiste en `localStorage`.

## Componentes y datos

```mermaid
classDiagram
  class Product {
    +string id
    +string name
    +string category
    +number price
    +string image
    +string description
    +boolean inStock
  }
  class App {
    +search: string
    +category: string
    +cart: CartMap
    +addToCart(product, quantity)
    +changeQuantity(product, change)
  }
  class ProductGrid
  class ProductCard
  class ProductDetail {
    +quantity: number
  }
  class ProductRoute {
    +findProductByPath(path, products)
  }
  class WhatsApp {
    +buildWhatsAppUrl(items)
  }

  App --> ProductGrid
  ProductGrid --> ProductCard
  ProductCard --> Product : muestra
  App --> ProductRoute : resuelve URL
  App --> ProductDetail : muestra detalle
  ProductDetail --> Product : muestra
  ProductDetail --> App : agrega al carrito
  App --> WhatsApp : arma pedido
```

## Secuencia de compra

```mermaid
sequenceDiagram
  actor U as Usuario
  participant C as ProductCard
  participant B as Navegador
  participant A as App
  participant D as ProductDetail
  participant S as localStorage
  participant W as WhatsApp

  U->>C: selecciona producto
  C->>B: abre enlace del producto
  B->>A: carga URL de detalle
  A->>A: busca producto por id
  alt id inexistente
    A-->>U: producto no encontrado y volver
  else id existente
    A->>D: muestra datos del producto
    U->>D: elige cantidad y agrega
    D->>A: addToCart(producto, cantidad)
    A->>S: guarda carrito
    U->>A: abre carrito
    U->>W: abre pedido prearmado
  end
```

Para un despliegue público, el servidor debe devolver `index.html` cuando se accede directamente a una URL de producto; Vite ya lo hace en desarrollo.
