import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db, ensureSchema } from '@/lib/db'
import { currentAdmin } from '@/lib/auth'
import { log, route, readJson } from '@/lib/log'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public: list saved templates (anonymous configs — no personal data).
export const GET = route('templates.GET', async () => {
  try {
    await ensureSchema()
    const rows = (await db().query('SELECT id, name, config FROM templates ORDER BY sort_order, created_at')).rows
    return NextResponse.json({ templates: rows }, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' } })
  } catch (err) {
    // Public page must still render, so we keep the empty-list fallback — but a
    // dead database is now visible in the logs instead of looking like "no
    // templates saved yet".
    log.error('templates.listFailed', err, { route: 'templates.GET' })
    return NextResponse.json({ templates: [] })
  }
})

// Admin only: save the current setup as a named template.
export const POST = route('templates.POST', async (req: NextRequest) => {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 401 })
  const { name, config } = await readJson<{ name: string; config: unknown }>(req, 'templates.POST')
  if (!name || typeof config !== 'object') return NextResponse.json({ ok: false, error: 'name + config required' }, { status: 400 })
  await ensureSchema()
  const id = crypto.randomBytes(6).toString('base64url')
  await db().query('INSERT INTO templates (id, name, config) VALUES ($1,$2,$3)', [id, name.slice(0, 60), config])
  log.info('templates.created', { id })
  return NextResponse.json({ ok: true, id })
})

// Admin only: overwrite an existing template (edit, no duplicate).
export const PATCH = route('templates.PATCH', async (req: NextRequest) => {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 401 })
  const { id, name, config } = await readJson<{ id: string; name: string; config: unknown }>(req, 'templates.PATCH')
  if (!id || !name || typeof config !== 'object') return NextResponse.json({ ok: false, error: 'id + name + config required' }, { status: 400 })
  await ensureSchema()
  const r = await db().query('UPDATE templates SET name=$2, config=$3, updated_at=now() WHERE id=$1', [id, name.slice(0, 60), config])
  if (r.rowCount === 0) {
    log.warn('templates.updateMissing', { id })
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }
  log.info('templates.updated', { id })
  return NextResponse.json({ ok: true, id })
})

// Admin only: delete a template by id (?id=).
export const DELETE = route('templates.DELETE', async (req: NextRequest) => {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  await ensureSchema()
  const r = await db().query('DELETE FROM templates WHERE id=$1', [id])
  log.info('templates.deleted', { id, rows: r.rowCount })
  return NextResponse.json({ ok: true })
})
