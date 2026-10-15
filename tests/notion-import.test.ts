import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTable, detectColumns, previewImport, parseStudyDate } from '../src/application/notion-import.js';
import { planDay } from '../src/engine/planner.js';
import { fixtures, inputFor } from '../simulation/fixtures.js';

test('CSV do Notion: BOM, vírgulas, aspas, quebras e todas as colunas do cronograma', () => {
  const table = parseTable('\uFEFFÁrea,Tema,Assunto,Status,Próximo Estudo,Priming,Estudo,Questões,Retrieval,Importância,Rodízio\r\nMFC,Infectologia,"Arbo, viroses\ncom ""alarme""",Iniciado,06/10/2026,Yes,No,Yes,No,Alta,"MFC, Clínica"');
  const rows = previewImport(table,detectColumns(table.headers),true,[]);
  assert.equal(rows[0]!.errors.length,0);
  assert.equal(rows[0]!.content!.title,'Arbo, viroses\ncom "alarme"');
  assert.equal(rows[0]!.content!.importance,.95);
  assert.deepEqual(rows[0]!.content!.source,{status:'Iniciado',nextStudy:'2026-10-06',priming:true,studied:false,questions:true,retrieval:false,rotation:'MFC, Clínica',originalImportance:'Alta',preserveDate:true});
});
test('Tabela colada e CSV com ponto e vírgula: mapeamento e duplicatas normalizadas', () => {
  const table = parseTable('Disciplina;Tópico;Conteúdo\nMFC;Infectologia;Hanseníase\n mfc ; infectologia ; Hanseniase ');
  assert.equal(previewImport(table,detectColumns(table.headers),false,[]).filter(r=>r.duplicate).length,1);
  assert(previewImport(table,detectColumns(table.headers),false,[{area:'MFC',topic:'Infectologia',title:'HANSENÍASE'}]).every(r=>r.duplicate));
  assert.equal(parseTable('Área\tTema\tAssunto\nMFC\tInfectologia\tArboviroses').rows.length,1);
});
test('Datas, campos e CSV inválidos são sinalizados sem inventar valores', () => {
  assert.throws(()=>parseStudyDate('31/02/2026'));
  assert.throws(()=>parseStudyDate('10/15/26'));
  assert.throws(()=>parseStudyDate('2026-10-06 → 2026-10-08'));
  assert.throws(()=>parseStudyDate('06/10/2026 a 08/10/2026'));
  assert.equal(parseStudyDate('2026-10-06'),'2026-10-06');
  assert.equal(parseStudyDate('October 6, 2026'),'2026-10-06');
  assert.throws(()=>parseTable('Área,Tema,Assunto\nMFC,Inf,"aberto'));
  assert.throws(()=>parseTable('Área,Tema,Assunto\nMFC,Inf'));
  assert.throws(()=>parseTable('Área,Área\nA,B'));
  const table = parseTable('Área,Tema,Assunto,Próximo Estudo,Estudo,Importância\nMFC,Inf,Arbo,31/02/2026,Yes,Alta\nMFC,Inf,Hans,,Talvez,Alta\nMFC,Inf,TB,,No,Urgente');
  const rows = previewImport(table,detectColumns(table.headers),false,[]);
  assert.equal(rows.filter(r=>r.errors.length).length,2);
  assert.equal(rows[2]!.warnings.length,1);
  assert.equal(rows[2]!.content!.importance,.65);
  assert.throws(()=>parseTable('Área,Tema,Assunto\n'+'A,T,C\n'.repeat(1001)));
});
test('Estudo importado oferece recuperação, com FSRS vazio e sem evidência fabricada', () => {
  const c = fixtures().find(c=>c.card.reps===0)!;
  const imported = {...c, notionSource:{status:'Iniciado',nextStudy:null,priming:false,studied:true,questions:false,retrieval:false,rotation:'',originalImportance:'',preserveDate:false}};
  const plan = planDay({...inputFor([imported],20),maxEffort:'low'});
  assert.equal(plan.items[0]!.method,'recall');
  assert.equal(plan.items[0]!.priority.retention,null);
  assert.match(plan.items[0]!.priority.reasons[0]!,/Estudo informado/);
  assert.equal(imported.card.reps,0);
});
