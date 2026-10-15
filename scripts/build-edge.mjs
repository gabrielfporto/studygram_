import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('supabase/functions/study-session', { recursive: true });
const versions = { '@supabase/supabase-js': '2.117.3', 'zod': '4.6.7', 'ts-fsrs': '5.4.2' };
const result = await build({ entryPoints: ['server/session-handler.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  plugins: [{ name: 'deno-dependencies', setup(build) { build.onResolve({ filter: /^(@supabase\/supabase-js|zod|ts-fsrs)$/ }, args => ({ path: `npm:${args.path}@${versions[args.path]}`, external: true })); } }],
});
const code = result.outputFiles[0].text + `\nDeno.serve(request => handleSession(request, { url: Deno.env.get('SUPABASE_URL'), anonKey: Deno.env.get('SUPABASE_ANON_KEY'), serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') }));\n`;
await writeFile('supabase/functions/study-session/index.ts', code);

await mkdir('supabase/functions/study-ai',{recursive:true});
const ai=await build({entryPoints:['server/ai-handler.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',plugins:[{name:'deno-ai-dependencies',setup(build){build.onResolve({filter:/^(@supabase\/supabase-js|zod)$/},args=>({path:`npm:${args.path}@${versions[args.path]}`,external:true}));}}]});
await writeFile('supabase/functions/study-ai/index.ts',ai.outputFiles[0].text+`\nDeno.serve(request=>handleAI(request,{url:Deno.env.get('SUPABASE_URL'),anonKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),apiKey:Deno.env.get('OPENAI_API_KEY'),model:Deno.env.get('AI_MODEL_SIMPLE'),provider:Deno.env.get('AI_PROVIDER')}));\n`);
