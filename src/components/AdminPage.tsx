import { useEffect, useState, type FormEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { fetchAdminProducts, saveAdminProduct, setProductActive, type ManagedProduct } from '../data/products'

type Props = { client: SupabaseClient | null }

type Draft = {
  name: string
  category: string
  description: string
  price: string
  inStock: boolean
  isActive: boolean
}

const emptyDraft: Draft = {
  name: '',
  category: '',
  description: '',
  price: '',
  inStock: true,
  isActive: true,
}

export function AdminPage({ client }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(client))
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<ManagedProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [reloadProducts, setReloadProducts] = useState(0)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ManagedProduct | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoInputKey, setPhotoInputKey] = useState(0)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!client) return

    let active = true
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      setAuthError('')
    })

    client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setSession(data.session)
      setAuthError(error?.message ?? '')
      setAuthLoading(false)
    }).catch((error: unknown) => {
      if (!active) return
      setAuthError(error instanceof Error ? error.message : 'No se pudo comprobar la sesión.')
      setAuthLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])

  const isAdmin = session?.user.app_metadata?.role === 'admin'

  useEffect(() => {
    if (!client || !isAdmin) return

    let active = true
    setProductsLoading(true)
    setProductsError('')
    fetchAdminProducts()
      .then((rows) => {
        if (active) setProducts(rows)
      })
      .catch((error: unknown) => {
        if (active) setProductsError(error instanceof Error ? error.message : 'No se pudieron cargar los productos.')
      })
      .finally(() => {
        if (active) setProductsLoading(false)
      })

    return () => { active = false }
  }, [client, isAdmin, reloadProducts])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) return
    setAuthError('')
    try {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    }
  }

  async function signOut() {
    if (!client) return
    try {
      const { error } = await client.auth.signOut()
      if (error) setAuthError(error.message)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo cerrar sesión.')
    }
  }

  function startNewProduct() {
    setEditing(null)
    setDraft(emptyDraft)
    setPhoto(null)
    setPhotoInputKey((key) => key + 1)
    setFormError('')
    setNotice('')
  }

  function startEditing(product: ManagedProduct) {
    setEditing(product)
    setDraft({
      name: product.name,
      category: product.category,
      description: product.description,
      price: String(product.price),
      inStock: product.inStock,
      isActive: product.isActive,
    })
    setPhoto(null)
    setPhotoInputKey((key) => key + 1)
    setFormError('')
    setNotice('')
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const price = Number(draft.price)
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Ingresá un precio válido, igual o mayor que cero.')
      return
    }

    setSaving(true)
    setFormError('')
    setNotice('')
    try {
      const saved = await saveAdminProduct({
        ...draft,
        name: draft.name.trim(),
        category: draft.category.trim(),
        description: draft.description.trim(),
        price,
        id: editing?.id,
        imagePath: editing?.imagePath,
        photo,
      })
      setProducts((current) => editing
        ? current.map((product) => product.id === saved.id ? saved : product)
        : [saved, ...current])
      setNotice(editing ? 'Producto actualizado.' : 'Producto creado.')
      setEditing(null)
      setDraft(emptyDraft)
      setPhoto(null)
      setPhotoInputKey((key) => key + 1)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(product: ManagedProduct) {
    setProductsError('')
    try {
      await setProductActive(product.id, !product.isActive)
      setProducts((current) => current.map((item) => item.id === product.id
        ? { ...item, isActive: !item.isActive }
        : item))
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'No se pudo cambiar la visibilidad.')
    }
  }

  if (!client) {
    return <section className="admin-message"><h1>Admin sin configurar</h1><p>Agregá las variables de Supabase del proyecto para habilitar el panel.</p></section>
  }

  if (authLoading) return <section className="admin-message" role="status">Comprobando sesión…</section>

  if (!session) {
    return (
      <section className="admin-section" aria-labelledby="admin-title">
        <form className="admin-login" onSubmit={signIn}>
          <h1 id="admin-title">Administrar tienda</h1>
          <p>Ingresá con la cuenta administradora.</p>
          <label htmlFor="admin-email">Correo</label>
          <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="admin-password">Contraseña</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {authError && <p className="admin-error" role="alert">{authError}</p>}
          <button className="admin-primary" type="submit">Entrar</button>
        </form>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="admin-message">
        <h1>Sin permisos de administración</h1>
        <p>Esta cuenta inició sesión, pero no tiene el rol de administradora.</p>
        <button className="admin-secondary" type="button" onClick={signOut}>Cerrar sesión</button>
      </section>
    )
  }

  return (
    <section className="admin-section" aria-labelledby="admin-title">
      <header className="admin-heading">
        <div><h1 id="admin-title">Productos</h1><p>Administrá precios, stock y fotos.</p></div>
        <button className="admin-secondary" type="button" onClick={signOut}>Cerrar sesión</button>
      </header>

      <div className="admin-layout">
        <form className="admin-form" onSubmit={saveProduct}>
          <h2>{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
          <label htmlFor="product-name">Nombre</label>
          <input id="product-name" required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <label htmlFor="product-category">Categoría</label>
          <input id="product-category" list="product-categories" required maxLength={60} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
          <datalist id="product-categories">
            {[...new Set(products.map((product) => product.category))].map((item) => <option key={item} value={item} />)}
          </datalist>
          <label htmlFor="product-price">Precio (ARS)</label>
          <input id="product-price" type="number" min="0" step="0.01" required value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
          <label htmlFor="product-description">Descripción</label>
          <textarea id="product-description" rows={4} maxLength={1000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <label htmlFor="product-photo">Foto (JPG, PNG o WebP; hasta 5 MB)</label>
          <input key={photoInputKey} id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          {editing?.imagePath && !photo && <p className="admin-help">Ya hay una foto. Elegí un archivo para reemplazarla.</p>}
          <label className="admin-check"><input type="checkbox" checked={draft.inStock} onChange={(event) => setDraft({ ...draft, inStock: event.target.checked })} /> Disponible</label>
          <label className="admin-check"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Visible en la tienda</label>
          {formError && <p className="admin-error" role="alert">{formError}</p>}
          <div className="admin-form-actions">
            <button className="admin-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar producto'}</button>
            {editing && <button className="admin-secondary" type="button" onClick={startNewProduct}>Cancelar edición</button>}
          </div>
          {notice && <p className="admin-success" role="status">{notice}</p>}
        </form>

        <div className="admin-products">
          <h2>Catálogo ({products.length})</h2>
          {productsLoading && <p role="status">Cargando productos…</p>}
          {productsError && (
            <div role="alert">
              <p className="admin-error">{productsError}</p>
              <button className="admin-secondary" type="button" onClick={() => setReloadProducts((value) => value + 1)}>Reintentar</button>
            </div>
          )}
          {!productsLoading && products.length === 0 && <p>Todavía no hay productos cargados.</p>}
          <ul>
            {products.map((product) => (
              <li className="admin-product" key={product.id}>
                {product.imagePath
                  ? <img src={product.image} alt="" />
                  : <span className="admin-no-photo" aria-hidden="true">Sin foto</span>}
                <div className="admin-product-info">
                  <strong>{product.name}</strong>
                  <span>{product.category} · {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(product.price)}</span>
                  <span>{product.isActive ? 'Visible' : 'Oculto'} · {product.inStock ? 'Disponible' : 'Sin stock'}</span>
                </div>
                <div className="admin-product-actions">
                  <button className="admin-secondary" type="button" onClick={() => startEditing(product)}>Editar</button>
                  <button className="admin-secondary" type="button" onClick={() => void toggleActive(product)}>{product.isActive ? 'Ocultar' : 'Mostrar'}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
