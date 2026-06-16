import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db, ensureSchema } from '@/lib/db'
import { currentAdmin } from '@/lib/auth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public: list saved templates (anonymous configs — no personal data).
export async function GET() {
  try {
    await ensureSchema()
    const rows = (await db().query('SELECT id, name, config FROM templates ORDER BY sort_order, created_at')).rows
    return NextResponse.json({ templates: rows }, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' } })
  } catch {
    return NextResponse.json({ templates: [] })
  }
}

// Admin only: save the current setup as a named template.
export async function POST(req: NextRequest) {
  if (!currentAdmin()) return NextResponse.json({ ok: false }, { status: 401 })
  const { name, config } = await req.json().catch(() => ({})) as { name?: string; config?: unknown }
  if (!name || typeof config !== 'object') return NextResponse.json({ ok: false, error: 'name + config required' }, { status: 400 })
  await ensureSchema()
  const id = crypto.randomBytes(6).toString('base64url')
  await db().query('INSERT INTO templates (id, name, config) VALUES ($1,$2,$3)', [id, name.slice(0, 60), config])
  return NextResponse.json({ ok: true, id })
}

// Admin only: delete a template by id (?id=).
export async function DELETE(req: NextRequest) {
  if (!currentAdmin()) return NextResponse.json({ ok: false }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  await ensureSchema()
  await db().query('DELETE FROM templates WHERE id=$1', [id])
  return NextResponse.json({ ok: true })
}
