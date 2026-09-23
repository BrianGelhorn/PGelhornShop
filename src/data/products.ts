import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from '../types'
import { supabase } from '../lib/supabase'

export type ManagedProduct = Product & {
  imagePath: string | null
  isActive: boolean
}

export type ProductInput = Omit<ManagedProduct, 'id' | 'image' | 'imagePath'> & {
  id?: string
  imagePath?: string | null
  photo?: File | null
}

type ProductRow = {
  id: string
  name: string
  category: string
  description: string
  price: number | string
  image_path: string | null
  in_stock: boolean
  is_active: boolean
}

const columns = 'id,name,category,description,price,image_path,in_stock,is_active'
const imageBucket = 'product-images'
const allowedImageTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function clientOrThrow(): SupabaseClient {
  if (!supabase) throw new Error('Supabase no está configurado.')
  return supabase
}

function toProduct(row: ProductRow, client: SupabaseClient): ManagedProduct {
  const image = row.image_path
    ? client.storage.from(imageBucket).getPublicUrl(row.image_path).data.publicUrl
    : ''

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    image,
    imagePath: row.image_path,
    inStock: row.in_stock,
    isActive: row.is_active,
  }
}

export async function fetchPublicProducts(): Promise<Product[]> {
  const client = clientOrThrow()
  const { data, error } = await client
    .from('products')
    .select(columns)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as ProductRow[]).map((row) => toProduct(row, client))
}

export async function fetchAdminProducts(): Promise<ManagedProduct[]> {
  const client = clientOrThrow()
  const { data, error } = await client
    .from('products')
    .select(columns)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as ProductRow[]).map((row) => toProduct(row, client))
}

export async function saveAdminProduct(input: ProductInput): Promise<ManagedProduct> {
  const client = clientOrThrow()
  const id = input.id ?? crypto.randomUUID()
  const oldImagePath = input.imagePath ?? null
  let imagePath = oldImagePath
  let uploadedPath: string | null = null

  if (input.photo) {
    const extension = allowedImageTypes[input.photo.type]
    if (!extension) throw new Error('La foto debe ser JPG, PNG o WebP.')
    if (input.photo.size > 5 * 1024 * 1024) throw new Error('La foto no puede superar 5 MB.')

    uploadedPath = `${id}/${crypto.randomUUID()}.${extension}`
    const { error } = await client.storage.from(imageBucket).upload(uploadedPath, input.photo, {
      contentType: input.photo.type,
      upsert: false,
    })
    if (error) throw error
    imagePath = uploadedPath
  }

  const { data, error } = await client
    .from('products')
    .upsert({
      id,
      name: input.name.trim(),
      category: input.category.trim(),
      description: input.description.trim(),
      price: input.price,
      image_path: imagePath,
      in_stock: input.inStock,
      is_active: input.isActive,
    })
    .select(columns)
    .single()

  if (error) {
    if (uploadedPath) await client.storage.from(imageBucket).remove([uploadedPath])
    throw error
  }

  if (oldImagePath && uploadedPath && oldImagePath !== uploadedPath) {
    await client.storage.from(imageBucket).remove([oldImagePath])
  }

  return toProduct(data as ProductRow, client)
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await clientOrThrow()
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) throw error
}
