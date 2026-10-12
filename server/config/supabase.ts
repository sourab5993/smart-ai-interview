import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('https://') &&
    supabaseServiceKey &&
    supabaseServiceKey.length > 10 &&
    !supabaseUrl.includes('your-project-id')
  );
}

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return _supabaseClient;
}

export const supabase = getSupabaseClient();

/**
 * Verifies Supabase connection by performing a lightweight query.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  latencyMs?: number;
  tablesCreated?: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: 'Supabase credentials not configured in .env',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: 'Failed to initialize Supabase client.' };
  }

  const start = Date.now();
  try {
    const { error } = await client.from('users').select('id', { count: 'exact', head: true });
    const latencyMs = Date.now() - start;

    if (error) {
      // If table doesn't exist yet, connection is still technically reachable
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return {
          ok: true,
          tablesCreated: false,
          message: 'Supabase connected! Tables not created yet. Run supabase_schema.sql in Supabase SQL Editor.',
          latencyMs,
        };
      }
      return {
        ok: false,
        tablesCreated: false,
        message: error.message || 'Supabase query failed',
        latencyMs,
      };
    }

    return {
      ok: true,
      tablesCreated: true,
      message: 'Supabase PostgreSQL connected and tables ready!',
      latencyMs,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Failed to reach Supabase',
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Uploads a document (e.g. resume) to Supabase Storage bucket.
 */
export async function uploadResumeToSupabase(
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url?: string; path?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: 'Supabase not configured' };
  }

  try {
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `resumes/${safeName}`;

    const { error: uploadError } = await client.storage
      .from('resumes')
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { data: publicUrlData } = client.storage
      .from('resumes')
      .getPublicUrl(storagePath);

    return {
      url: publicUrlData?.publicUrl,
      path: storagePath,
    };
  } catch (err: any) {
    return { error: err?.message || 'Storage upload error' };
  }
}
