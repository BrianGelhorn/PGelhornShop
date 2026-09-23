import type { Product } from './types'

export function findProductByPath(pathname: string, products: Product[]) {
  const match = /^\/producto\/([^/]+)$/.exec(pathname)
  return match ? products.find((product) => encodeURIComponent(product.id) === match[1]) : undefined
}
