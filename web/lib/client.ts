import { createClient } from '@supabase/supabase-js';
// Chave publicável: identifica o projeto; autorização é feita por Auth + RLS.
export const supabase = createClient(
  import.meta.env?.VITE_SUPABASE_URL || 'https://aksjxellsgshapbntoby.supabase.co',
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BSQi8IwlIIDMdLQGt5jTAQ_S3U_pKej',
);
export const callbackUrl = () => new URL(import.meta.env?.BASE_URL ?? '/studygram_/', window.location.origin).href;
