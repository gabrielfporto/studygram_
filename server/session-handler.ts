import { createClient } from '@supabase/supabase-js';
import { sessionSchema, prepareReview } from '../src/application/session.js';
import type { Evidence } from '../src/domain/model.js';

interface Env { url: string; anonKey: string; serviceKey: string }
const allowedOrigins = ['https://gabrielfporto.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
export async function handleSession(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin') ?? '';
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]!,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond({ error: 'Método inválido' }, 405);
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return respond({ error: 'Entre novamente na sua conta.' }, 401);
  const auth = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(bearer.slice(7));
  if (authError || !user) return respond({ error: 'Sessão inválida. Entre novamente.' }, 401);
  try {
    const body = await request.text();
    if (body.length > 16_000) return respond({ error: 'Registro muito grande' }, 413);
    const parsed = sessionSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return respond({ error: parsed.error.issues[0]?.message ?? 'Registro inválido' }, 400);
    const input = parsed.data;
    const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existing, error: existingError } = await admin.from('study_sessions').select('id').eq('user_id', user.id).eq('idempotency_key', input.idempotencyKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return respond({ id: existing.id, duplicate: true });
    const [reviewResult, evidenceResult] = await Promise.all([
      admin.from('reviews').select('card,revision').eq('user_id', user.id).eq('competency_id', input.competencyId).maybeSingle(),
      admin.from('question_sessions').select('occurred_at,total,correct').eq('user_id', user.id).eq('competency_id', input.competencyId).order('occurred_at', { ascending: false }).limit(20),
    ]);
    if (reviewResult.error || evidenceResult.error) throw reviewResult.error ?? evidenceResult.error;
    const history: Evidence[] = (evidenceResult.data ?? []).map(e => ({ at: new Date(e.occurred_at), total: e.total,
      correct: e.correct, errors: e.total - e.correct, recurringErrors: 0, reportedDifficulty: 0.5 }));
    const memory = prepareReview(input, reviewResult.data?.card ?? null, history, new Date());
    const result = await admin.rpc('commit_study_session', { p_user: user.id, p_input: input,
      p_expected_revision: reviewResult.data?.revision ?? 0, p_memory: memory });
    if (result.error) {
      if (result.error.message.includes('REVISION_CONFLICT')) return respond({ error: 'Outra sessão foi salva. Atualize e tente novamente.' }, 409);
      throw result.error;
    }
    return respond(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Sessão no futuro|Revisão fora de ordem|JSON/.test(message)) return respond({ error: message }, 400);
    return respond({ error: 'Não foi possível salvar. Seu registro permanece aberto para tentar novamente.' }, 500);
  }
}
