import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { prepareReview, type SessionInput } from '../src/application/session.js';

// PostgreSQL WASM real; auth.uid/roles abaixo são apenas o harness local, não Supabase Auth.
test('Migrations: PostgreSQL, RLS entre dois usuários, grants e FKs compostas', async () => {
  const db = new PGlite();
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';
  const id = (n: number, user = 1) => `10000000-0000-4000-8000-${String(user * 1000 + n).padStart(12, '0')}`;
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      insert into auth.users values ('${a}'), ('${b}');
    `);
    for (const file of readdirSync('supabase/migrations').sort()) {
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    // Instanciar as duas cadeias completas de catálogo, contexto, evidência e plano.
    for (const [index, user] of [a, b].entries()) {
      const x = (n: number) => id(n, index + 1);
      await db.exec(`
        insert into profiles(user_id) values ('${user}');
        insert into study_areas(id,user_id,title) values ('${x(1)}','${user}','Área');
        insert into topics(id,user_id,area_id,title) values ('${x(2)}','${user}','${x(1)}','Tema');
        insert into competencies(id,user_id,topic_id,title) values ('${x(3)}','${user}','${x(2)}','Competência');
        insert into academic_contexts(id,user_id,title) values ('${x(4)}','${user}','Contexto');
        insert into competency_contexts values ('${user}','${x(3)}','${x(4)}');
        insert into rotations(id,user_id,context_id,starts_at,ends_at) values ('${x(5)}','${user}','${x(4)}','2026-10-01','2026-11-01');
        insert into exams(id,user_id,title,occurs_at) values ('${x(6)}','${user}','Prova','2026-10-20');
        insert into exam_competencies values ('${user}','${x(6)}','${x(3)}');
        insert into study_sessions(id,user_id,competency_id,idempotency_key,actual_minutes,started_at,method,status)
          values ('${x(7)}','${user}','${x(3)}','${x(70)}',20,'2026-10-14','recall','completed');
        insert into reviews(id,user_id,competency_id,difficulty,stability,next_review,learning_state,card,algorithm_version)
          values ('${x(8)}','${user}','${x(3)}',5,2,'2026-10-18','learning','{}','v1');
        insert into review_events(id,user_id,review_id,session_id,occurred_at,rating,before_card,after_card,algorithm_version,parameters)
          values ('${x(9)}','${user}','${x(8)}','${x(7)}','2026-10-14',3,'{}','{}','v1','{}');
        insert into question_sessions(id,user_id,competency_id,session_id,total,correct,occurred_at)
          values ('${x(10)}','${user}','${x(3)}','${x(7)}',10,8,'2026-10-14');
        insert into mistakes(id,user_id,competency_id,question_session_id,description,occurred_at)
          values ('${x(11)}','${user}','${x(3)}','${x(10)}','Erro','2026-10-14');
        insert into availability_rules(id,user_id,weekday,starts_local,ends_local,daily_cap_minutes)
          values ('${x(12)}','${user}',1,'18:00','19:00',60);
        insert into calendar_connections(id,user_id,provider,external_calendar_id,status)
          values ('${x(13)}','${user}','google','calendar','connected');
        insert into private.calendar_credentials values ('${user}','${x(13)}','vault-reference',null);
        insert into calendar_events(id,user_id,connection_id,external_id,starts_at,ends_at,status)
          values ('${x(14)}','${user}','${x(13)}','event','2026-10-14 18:00Z','2026-10-14 19:00Z','busy');
        insert into daily_plans(id,user_id,local_date,timezone,revision,capacity_minutes,engine_version,input_snapshot)
          values ('${x(15)}','${user}','2026-10-14','America/Bahia',1,60,'v1','{}');
        insert into daily_plan_items(id,user_id,plan_id,competency_id,starts_at,ends_at,method,priority_score,expected_value_per_minute,explanation)
          values ('${x(16)}','${user}','${x(15)}','${x(3)}','2026-10-14 20:00Z','2026-10-14 20:20Z','recall',75,3.75,'{}');
        insert into ai_usage(id,user_id,request_id,operation,provider,model,input_tokens,output_tokens)
          values ('${x(17)}','${user}','${x(71)}','classify','openai','configurable',100,20);
        insert into product_events(id,user_id,name) values ('${x(18)}','${user}','plan_generated');
      `);
    }
    const tables = (await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename")).rows;
    assert.equal(tables.length, 21);
    assert(tables.every(t => t.rowsecurity));
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
    for (const { tablename } of tables) {
      const rows = (await db.query<{ user_id: string }>(`select user_id from public.${tablename}`)).rows;
      assert.equal(rows.length, 1, tablename);
      assert.equal(rows[0]!.user_id, a, tablename);
    }
    const editable = ['profiles','study_areas','topics','competencies','academic_contexts','competency_contexts','rotations','exams','exam_competencies','availability_rules'];
    for (const table of editable) {
      const ownUpdate = await db.query(`update ${table} set user_id = user_id where user_id = '${a}' returning user_id`);
      assert.equal(ownUpdate.rows.length, 1, `${table}: update próprio`);
      await assert.rejects(db.exec(`insert into ${table}
        select (jsonb_populate_record(null::${table}, to_jsonb(t) || jsonb_build_object('user_id','${b}'))).*
        from ${table} t limit 1`), /row-level security/);
      const updated = await db.query(`update ${table} set user_id = user_id where user_id = '${b}' returning user_id`);
      assert.equal(updated.rows.length, 0, `${table}: update de outra pessoa`);
      const deleted = await db.query(`delete from ${table} where user_id = '${b}' returning user_id`);
      assert.equal(deleted.rows.length, 0, `${table}: delete de outra pessoa`);
      await assert.rejects(db.exec(`update ${table} set user_id = '${b}' where user_id = '${a}'`));
    }
    await db.exec(`insert into study_areas(id,user_id,title) values ('${id(99)}','${a}','Nova');`);
    await db.exec(`update study_areas set title = 'Editada' where id = '${id(99)}';`);
    await db.exec(`delete from study_areas where id = '${id(99)}';`);
    await assert.rejects(db.exec(`insert into study_areas(user_id,title) values ('${b}','Invasão')`), /row-level security/);
    await assert.rejects(db.exec(`insert into topics(user_id,area_id,title) values ('${a}','${id(1, 2)}','Vínculo cruzado')`), /foreign key/);
    await assert.rejects(db.exec('select * from private.calendar_credentials'), /permission denied/);
    for (const { tablename } of tables.filter(t => !editable.includes(t.tablename))) {
      await assert.rejects(db.exec(`delete from ${tablename} where user_id = '${a}'`), /permission denied/);
      await assert.rejects(db.exec(`update ${tablename} set user_id = user_id`), /permission denied/);
      await assert.rejects(db.exec(`insert into ${tablename} default values`), /permission denied/);
    }
    await db.exec('reset role; set role anon;');
    for (const { tablename } of tables) {
      await assert.rejects(db.exec(`select * from ${tablename}`), /permission denied/);
      await assert.rejects(db.exec(`insert into ${tablename} default values`), /permission denied/);
      await assert.rejects(db.exec(`update ${tablename} set user_id = user_id`), /permission denied/);
      await assert.rejects(db.exec(`delete from ${tablename}`), /permission denied/);
    }
    await db.exec('reset role;');
    await assert.rejects(db.exec(`insert into question_sessions(user_id,competency_id,total,correct,occurred_at) values ('${a}','${id(3)}',5,6,now())`), /check constraint/);
    await assert.rejects(db.exec(`insert into study_sessions(user_id,competency_id,idempotency_key,actual_minutes,started_at,method,status) values ('${a}','${id(3)}','${id(70)}',10,now(),'recall','completed')`), /unique constraint/);
    // Casos de uso reais: configuração/importação sob RLS e gravação só pelo servidor.
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
    const rules = Array.from({length:7},(_,weekday)=>({weekday,start:'18:00',end:'20:00',minutes:60,effort:'high'}));
    await db.query('select configure_study($1,$2,$3,$4::jsonb)', ['Internato','America/Bahia','Emergência',JSON.stringify(rules)]);
    await db.query('select configure_study($1,$2,$3,$4::jsonb)', ['Internato','America/Bahia','Emergência',JSON.stringify(rules)]);
    const imported = await db.query('select import_topic($1,$2,$3::text[],$4,$5)', ['Clínica','SCA',['ECG','Diagnóstico'],0.9,null]);
    assert.equal(imported.rows.length,1);
    await assert.rejects(db.query('select configure_study($1,$2,$3,$4::jsonb)', ['Erro','Fuso/Invalido','MFC',JSON.stringify(rules)]));
    const saved = await db.query<{goal:string}>('select goal from profiles'); assert.equal(saved.rows[0]!.goal,'Internato');
    const row = {area:'MFC',topic:'Infectologia',title:'Hanseníase',importance:.95,
      source:{status:'Iniciado',nextStudy:'2026-10-06',priming:true,studied:true,questions:false,retrieval:false,rotation:'MFC, MFC',originalImportance:'Alta',preserveDate:true}};
    const importBatch = (items:unknown[]) => db.query<{import_schedule:{inserted:number;skipped:number}}>('select import_schedule($1::jsonb)',[JSON.stringify(items)]);
    const batch = await importBatch([row,{...row,title:'Arboviroses'}]);
    assert.deepEqual(batch.rows[0]!.import_schedule,{inserted:2,skipped:0});
    const repeated = await importBatch([{...row,area:' mfc ',title:'hanseniase'}]);
    assert.deepEqual(repeated.rows[0]!.import_schedule,{inserted:0,skipped:1});
    const history = await db.query<{notion_source:typeof row.source}>("select notion_source from competencies where title='Hanseníase'");
    assert.deepEqual(history.rows[0]!.notion_source,row.source);
    assert.equal((await db.query("select * from reviews r join competencies c on r.competency_id=c.id where c.notion_source is not null")).rows.length,0);
    assert.equal((await db.query("select * from study_sessions s join competencies c on s.competency_id=c.id where c.notion_source is not null")).rows.length,0);
    assert.equal((await db.query("select * from competency_contexts cc join competencies c on c.id=cc.competency_id where c.notion_source is not null")).rows.length,2);
    await assert.rejects(importBatch([{...row,title:'Não persistir'},{...row,title:'Data ruim',source:{...row.source,nextStudy:'2026-02-31'}}]));
    assert.equal((await db.query("select * from competencies where title='Não persistir'")).rows.length,0);
    await assert.rejects(importBatch([{...row,importance:4}]));
    await assert.rejects(importBatch([{...row,source:{...row.source,studied:'yes'}}]));
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal((await db.query("select * from competencies where notion_source is not null")).rows.length,0);
    assert.equal((await importBatch([row])).rows[0]!.import_schedule.inserted,1);
    // Remove only the extra B fixture so the existing account-deletion assertions stay exact.
    await db.exec(`reset role; delete from competency_contexts where user_id='${b}' and competency_id in(select id from competencies where notion_source is not null);
      delete from competencies where user_id='${b}' and notion_source is not null;
      delete from topics where user_id='${b}' and title='Infectologia'; delete from study_areas where user_id='${b}' and title='MFC';
      delete from academic_contexts where user_id='${b}' and title='MFC'; set role anon;`);
    await assert.rejects(importBatch([row]),/permission denied/);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
    const input: SessionInput = { competencyId:id(3),idempotencyKey:id(90),actualMinutes:20,plannedMinutes:20,
      startedAt:'2026-10-15T15:10:00Z',endedAt:'2026-10-15T15:30:00Z',method:'recall',status:'completed',feedback:3,total:10,correct:8,notes:'' };
    const memory=prepareReview(input,null,[],new Date(input.endedAt));
    await assert.rejects(db.query('select commit_study_session($1,$2::jsonb,$3,$4::jsonb)',[a,JSON.stringify(input),1,JSON.stringify(memory)]),/permission denied/);
    await db.exec('reset role; set role service_role;');
    await db.query('select commit_study_session($1,$2::jsonb,$3,$4::jsonb)',[a,JSON.stringify(input),1,JSON.stringify(memory)]);
    const retry=await db.query<{commit_study_session:{duplicate:boolean}}>('select commit_study_session($1,$2::jsonb,$3,$4::jsonb)',[a,JSON.stringify(input),1,JSON.stringify(memory)]);
    assert.equal(retry.rows[0]!.commit_study_session.duplicate,true);
    await assert.rejects(db.query('select commit_study_session($1,$2::jsonb,$3,$4::jsonb)',[a,JSON.stringify({...input,idempotencyKey:id(91)}),1,JSON.stringify(memory)]),/REVISION_CONFLICT/);
    const count=await db.query<{count:number}>(`select count(*)::int as count from study_sessions where user_id='${a}'`); assert.equal(count.rows[0]!.count,2);
    const beforePriming=await db.query<{revision:number}>('select revision from reviews where competency_id=$1',[id(3)]);
    await db.query('select commit_study_session($1,$2::jsonb,$3,$4::jsonb)',[a,JSON.stringify({...input,idempotencyKey:id(92),method:'priming',actualMinutes:5,total:0,correct:0,notes:'Preparar uma pergunta'}),2,null]);
    const afterPriming=await db.query<{revision:number}>('select revision from reviews where competency_id=$1',[id(3)]);assert.deepEqual(beforePriming.rows,afterPriming.rows);
    await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`);
    await db.query('update competencies set resource_url=$1 where id=$2',['https://www.notion.so/material',id(3)]);
    await assert.rejects(db.query('update competencies set resource_url=$1 where id=$2',['javascript:alert(1)',id(3)]),/check constraint/);
    assert.equal((await db.query<{resource_url:string}>('select resource_url from competencies where id=$1',[id(3)])).rows[0]!.resource_url,'https://www.notion.so/material');
    await db.exec(`reset role; delete from auth.users where id = '${a}';`);
    for (const { tablename } of tables) {
      const remaining = (await db.query<{ user_id: string }>(`select user_id from ${tablename}`)).rows;
      assert.equal(remaining.length, 1, `${tablename}: exclusão da conta`);
      assert.equal(remaining[0]!.user_id, b);
    }
  } finally { await db.close(); }
});
