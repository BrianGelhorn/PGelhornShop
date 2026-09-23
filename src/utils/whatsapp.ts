import { config } from '../config'
import type { Product } from '../types'

type OrderItem = Pick<Product, 'name' | 'price'> & { quantity: number }

export const formatPrice = (price: number) => new Intl.NumberFormat(config.locale, {
  style: 'currency',
  currency: config.currency,
}).format(price)

export function buildWhatsAppUrl(items: OrderItem[]) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const lines = items.map((item) => (
    `- ${item.quantity} x ${item.name} — ${formatPrice(item.price * item.quantity)}`
  ))
  const message = [
    'Hola, quiero realizar el siguiente pedido:',
    '',
    ...lines,
    '',
    `Total estimado: ${formatPrice(total)}`,
    '',
    '¿Podrían confirmarme disponibilidad y formas de entrega?',
  ].join('\n')

  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`
}
