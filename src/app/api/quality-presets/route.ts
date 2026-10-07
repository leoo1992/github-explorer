import { NextRequest } from 'next/server';
import { getAccessState } from '@/lib/access';
import {
  filterQualityCriteriaIdsForLanguages,
  sanitizeQualityCriteriaIds,
  sanitizeQualityLanguage,
} from '@/lib/quality-criteria';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MAX_PRESETS_PER_USER = 20;
const MAX_NAME_LENGTH = 60;

type PresetRow = {
  id: string;
  name: string;
  language: string | null;
  criteria_ids: string[];
  created_at: string;
  updated_at: string;
};

function presetDto(row: PresetRow) {
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    criteriaIds: row.criteria_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requirePaidPresetAccess() {
  const access = await getAccessState();

  if (!access.user) {
    return {
      access: null,
      response: Response.json(
        { error: 'Faça login para gerenciar presets.', code: 'AUTH_REQUIRED' },
        { status: 401, headers: { 'cache-control': 'private, no-store' } },
      ),
    };
  }

  if (!access.paid) {
    return {
      access: null,
      response: Response.json(
        { error: 'Presets personalizados fazem parte do plano ativo.', code: 'PAYMENT_REQUIRED' },
        { status: 402, headers: { 'cache-control': 'private, no-store' } },
      ),
    };
  }

  return { access, response: null };
}

export async function GET() {
  const gate = await requirePaidPresetAccess();
  if (gate.response) return gate.response;

  const userId = gate.access!.user!.id;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('quality_presets')
    .select('id, name, language, criteria_ids, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    return Response.json(
      { error: `Não foi possível carregar os presets: ${error.message}` },
      { status: 503, headers: { 'cache-control': 'private, no-store' } },
    );
  }

  return Response.json(
    { presets: (data as PresetRow[]).map(presetDto) },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const gate = await requirePaidPresetAccess();
  if (gate.response) return gate.response;

  const userId = gate.access!.user!.id;
  const body = await request.json().catch(() => null) as {
    name?: unknown;
    language?: unknown;
    criteriaIds?: unknown;
  } | null;

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > MAX_NAME_LENGTH) {
    return Response.json(
      { error: `O nome deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.` },
      { status: 422 },
    );
  }

  const requestedLanguage =
    typeof body?.language === 'string' && body.language.trim()
      ? body.language.trim()
      : null;
  const language = requestedLanguage ? sanitizeQualityLanguage(requestedLanguage) : null;

  if (requestedLanguage && !language) {
    return Response.json(
      { error: 'Linguagem não suportada para preset.' },
      { status: 422 },
    );
  }

  const requestedIds = Array.isArray(body?.criteriaIds)
    ? body!.criteriaIds.filter((value): value is string => typeof value === 'string')
    : [];

  if (!requestedIds.length) {
    return Response.json(
      { error: 'Selecione ao menos um critério para o preset.' },
      { status: 422 },
    );
  }

  const sanitized = sanitizeQualityCriteriaIds(requestedIds);
  const criteriaIds = language
    ? filterQualityCriteriaIdsForLanguages(sanitized, [language])
    : sanitized;

  if (!criteriaIds.length) {
    return Response.json(
      { error: 'Selecione ao menos um critério aplicável ao preset.' },
      { status: 422 },
    );
  }

  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from('quality_presets')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();

  if (existingError) {
    return Response.json(
      { error: `Não foi possível validar o preset: ${existingError.message}` },
      { status: 503 },
    );
  }

  if (!existing) {
    const { count, error: countError } = await supabase
      .from('quality_presets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      return Response.json(
        { error: `Não foi possível validar o limite de presets: ${countError.message}` },
        { status: 503 },
      );
    }

    if ((count ?? 0) >= MAX_PRESETS_PER_USER) {
      return Response.json(
        { error: `Limite de ${MAX_PRESETS_PER_USER} presets personalizados atingido.` },
        { status: 409 },
      );
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('quality_presets')
    .upsert(
      {
        user_id: userId,
        name,
        language,
        criteria_ids: criteriaIds,
        updated_at: now,
      },
      { onConflict: 'user_id,name' },
    )
    .select('id, name, language, criteria_ids, created_at, updated_at')
    .single();

  if (error) {
    return Response.json(
      { error: `Não foi possível salvar o preset: ${error.message}` },
      { status: 503 },
    );
  }

  return Response.json(
    { preset: presetDto(data as PresetRow) },
    { status: existing ? 200 : 201, headers: { 'cache-control': 'private, no-store' } },
  );
}

export async function DELETE(request: NextRequest) {
  const gate = await requirePaidPresetAccess();
  if (gate.response) return gate.response;

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return Response.json({ error: 'Informe o preset a remover.' }, { status: 422 });
  }

  const userId = gate.access!.user!.id;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('quality_presets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return Response.json(
      { error: `Não foi possível remover o preset: ${error.message}` },
      { status: 503 },
    );
  }

  return Response.json(
    { ok: true },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
