import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { IdempotencyKey, Log } from '@/lib/models';

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function hashRequestPayload(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

async function writeDuplicateLog(level, message, detail) {
  try {
    await Log.create({
      level,
      context: 'DUPLICATE_GUARD',
      message,
      detail: detail ? JSON.stringify(detail) : null,
    });
  } catch (_) {}
}

function buildReplayResponse(existing) {
  const body = existing.response_body ? JSON.parse(existing.response_body) : { success: true };
  return NextResponse.json(body, {
    status: existing.response_status || 200,
    headers: { 'x-idempotent-replay': 'true' },
  });
}

async function handleExistingKey(existing, requestHash, route, actorScope, actorId) {
  if (existing.request_hash !== requestHash) {
    await writeDuplicateLog(
      'WARN',
      `Idempotency key conflict pada ${route}`,
      { route, actorScope, actorId, idempotencyKey: existing.idempotency_key }
    );

    return {
      success: false,
      response: NextResponse.json(
        { success: false, pesan: 'Permintaan duplikat dengan payload berbeda terdeteksi' },
        { status: 409 }
      ),
    };
  }

  await existing.update({ last_seen_at: new Date() });

  if (existing.status === 'COMPLETED') {
    await writeDuplicateLog(
      'INFO',
      `Replay request dikembalikan untuk ${route}`,
      { route, actorScope, actorId, idempotencyKey: existing.idempotency_key }
    );

    return { success: false, response: buildReplayResponse(existing) };
  }

  await writeDuplicateLog(
    'WARN',
    `Request ganda yang masih diproses terdeteksi pada ${route}`,
    { route, actorScope, actorId, idempotencyKey: existing.idempotency_key }
  );

  return {
    success: false,
    response: NextResponse.json(
      { success: false, pesan: 'Permintaan yang sama masih sedang diproses' },
      { status: 409 }
    ),
  };
}

export async function claimIdempotency({
  request,
  route,
  payload,
  actorScope = 'public',
  actorId = null,
  ttlMs = DEFAULT_TTL_MS,
}) {
  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim();

  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, pesan: 'Header x-idempotency-key wajib diisi' },
        { status: 400 }
      ),
    };
  }

  try {
    const requestHash = hashRequestPayload(payload);
    const now = Date.now();
    const expiresAt = new Date(now + ttlMs);
    const existing = await IdempotencyKey.findOne({ where: { idempotency_key: idempotencyKey } });

    if (existing) {
      const isExpired = existing.expires_at && new Date(existing.expires_at).getTime() <= now;
      if (isExpired && existing.status !== 'PROCESSING') {
        try { await existing.destroy(); } catch (_) {}
      } else {
        return handleExistingKey(existing, requestHash, route, actorScope, actorId);
      }
    }

    try {
      const record = await IdempotencyKey.create({
        idempotency_key: idempotencyKey,
        route,
        actor_scope: actorScope,
        actor_id: actorId,
        request_hash: requestHash,
        status: 'PROCESSING',
        expires_at: expiresAt,
        last_seen_at: new Date(now),
      });

      return {
        success: true,
        guard: {
          record,
          route,
          actorScope,
          actorId,
        },
      };
    } catch (_) {
      const conflicted = await IdempotencyKey.findOne({ where: { idempotency_key: idempotencyKey } });
      if (conflicted) {
        return handleExistingKey(conflicted, requestHash, route, actorScope, actorId);
      }

      return {
        success: false,
        response: NextResponse.json(
          { success: false, pesan: 'Gagal memproses idempotency key' },
          { status: 500 }
        ),
      };
    }
  } catch (dbError) {
    // Tabel idempotency_keys belum ada atau DB error — lanjutkan tanpa perlindungan idempotency
    // Jalankan `npm run db:migrate` untuk membuat tabel yang hilang.
    console.warn('[request-guard] Idempotency service tidak tersedia, lanjutkan tanpa guard:', dbError?.message);
    return { success: true, guard: null };
  }
}

export async function respondWithGuard(guard, body, status = 200) {
  if (guard?.record) {
    await guard.record.update({
      status: 'COMPLETED',
      response_status: status,
      response_body: JSON.stringify(body),
      last_seen_at: new Date(),
    });
  }

  return NextResponse.json(body, { status });
}

export async function releaseGuard(guard) {
  if (!guard?.record) return;

  try {
    await guard.record.destroy();
  } catch (_) {}
}

export async function logDuplicateAttempt(message, detail) {
  await writeDuplicateLog('WARN', message, detail);
}