import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findProductByPath } from '../src/product-route.ts'

const products = [{ id: 'linterna-led' }, { id: 'juguete-niño' }]

test('rutas de producto directas y enlaces codificados', () => {
  assert.equal(findProductByPath('/producto/linterna-led', products), products[0])
  assert.equal(findProductByPath('/producto/juguete-ni%C3%B1o', products), products[1])
  assert.equal(findProductByPath('/producto/desconocido', products), undefined)
  assert.equal(findProductByPath('/producto/linterna-led/otra', products), undefined)
})
