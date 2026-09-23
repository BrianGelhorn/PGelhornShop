import { createClient } from '@supabase/supabase-js'

const [userId] = process.argv.slice(2)
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = process.env

if (!url || !serviceRoleKey || !userId) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/set-admin-role.mjs <user-uuid>')
  process.exit(1)
}

const client = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await client.auth.admin.getUserById(userId)
if (error || !data.user) {
  console.error(error?.message ?? 'No existe ese usuario.')
  process.exit(1)
}

const { error: updateError } = await client.auth.admin.updateUserById(userId, {
  app_metadata: { ...data.user.app_metadata, role: 'admin' },
})

if (updateError) {
  console.error(updateError.message)
  process.exit(1)
}

console.log(`Rol admin asignado a ${data.user.email ?? userId}. Cerrá e iniciá sesión para renovar el JWT.`)
