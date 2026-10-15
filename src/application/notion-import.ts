import { z } from 'zod';
import { notionSourceSchema } from '../domain/model.js';

export const importFields = {
  area: 'Área', topic: 'Tema', title: 'Assunto', status: 'Status', nextStudy: 'Próximo Estudo',
  priming: 'Priming', studied: 'Estudo', questions: 'Questões', retrieval: 'Retrieval', importance: 'Importância', rotation: 'Rodízio',
} as const;
export type ImportField = keyof typeof importFields;
export type ColumnMap = Record<ImportField, string>;
export const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const contentKey = (area: string, topic: string, title: string) => [area, topic, title].map(normalize).join('\u001f');

// RFC-style quoting, including escaped quotes and embedded newlines. No HTML evaluation.
export function parseTable(text: string): { headers: string[]; rows: string[][] } {
  if (text.length > 2_000_000) throw new Error('Use um arquivo de até 2 MB.');
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const first = clean.split('\n')[0] ?? '';
  const separator = [',', ';', '\t'].sort((a, b) => {
    const count = (s: string) => { let quotes = false; let n = 0; for (const c of first) { if (c === '"') quotes = !quotes; else if (!quotes && c === s) n++; } return n; };
    return count(b) - count(a);
  })[0]!;
  const records: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closed = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) { if (c === '"') { if (clean[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === separator || c === '\n') { row.push(cell.trim()); cell = ''; closed = false; if (c === '\n') { if (row.some(Boolean)) records.push(row); row = []; } }
    else if (c === '"') { if (cell || closed) throw new Error('Aspas inválidas no CSV. Exporte novamente do Notion.'); quoted = true; }
    else { if (closed && c.trim()) throw new Error('Conteúdo após o fechamento de aspas.'); if (!closed) cell += c; }
    if (records.length > 1001) throw new Error('Importe até 1.000 assuntos por vez.');
  }
  if (quoted) throw new Error('O CSV tem uma célula com aspas sem fechamento.');
  row.push(cell.trim()); if (row.some(Boolean)) records.push(row);
  const headers = records.shift() ?? [];
  if (!headers.length || !records.length) throw new Error('Inclua os nomes das colunas e pelo menos um assunto.');
  if (headers.some(h => !h) || new Set(headers.map(normalize)).size !== headers.length) throw new Error('As colunas precisam ter nomes preenchidos e diferentes.');
  if (records.length > 1000) throw new Error('Importe até 1.000 assuntos por vez.');
  if (records.some(r => r.length !== headers.length)) throw new Error('Há linhas com quantidade de colunas diferente do cabeçalho.');
  return { headers, rows: records };
}
export function detectColumns(headers: string[]): ColumnMap {
  const aliases: Record<ImportField, string[]> = {
    area: ['area', 'materia', 'disciplina'], topic: ['tema', 'topico'], title: ['assunto', 'conteudo', 'nome', 'competencia'],
    status: ['status', 'situacao'], nextStudy: ['proximo estudo', 'data', 'data de estudo'], priming: ['priming'],
    studied: ['estudo', 'estudou', 'estudo teorico', 'estudo realizado'], questions: ['questoes'], retrieval: ['retrieval', 'recuperacao'],
    importance: ['importancia', 'prioridade'], rotation: ['rodizio', 'contexto'],
  };
  return Object.fromEntries(Object.keys(importFields).map(key => [key, headers.find(h => aliases[key as ImportField].includes(normalize(h))) ?? ''])) as ColumnMap;
}
const name = z.string().trim().min(1).max(200);
export const importedContentSchema = z.object({
  area: name, topic: name, title: name, importance: z.number().min(0).max(1),
  source: notionSourceSchema.extend({ status: z.string().max(200), rotation: z.string().max(200), originalImportance: z.string().max(200) }),
});
export type ImportedContent = z.infer<typeof importedContentSchema>;
export function parseStudyDate(value: string): string | null {
  if (!value.trim()) return null;
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const english = value.trim().match(/^([A-Za-z]+) (\d{1,2}),? (\d{4})$/);
  const month = english ? ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(english[1]!.toLowerCase()) + 1 : 0;
  if (!iso && !br && !month) throw new Error('Data inválida: use DD/MM/AAAA ou AAAA-MM-DD (sem intervalo).');
  const result = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : br ? `${br[3]}-${br[2]!.padStart(2,'0')}-${br[1]!.padStart(2,'0')}` : `${english![3]}-${String(month).padStart(2,'0')}-${english![2]!.padStart(2,'0')}`;
  if (!z.string().date().safeParse(result).success) throw new Error('Data de estudo inexistente.');
  return result;
}
export interface PreviewRow { line: number; content: ImportedContent | null; errors: string[]; warnings: string[]; duplicate: boolean }
export function previewImport(table: ReturnType<typeof parseTable>, mapping: ColumnMap, preserveDate: boolean,
  existing: { area: string; topic: string; title: string }[]): PreviewRow[] {
  const seen = new Set(existing.map(c => contentKey(c.area, c.topic, c.title)));
  return table.rows.map((row, index) => {
    const get = (key: ImportField) => row[table.headers.indexOf(mapping[key])] ?? '';
    const warnings: string[] = [];
    try {
      const check = (key: ImportField) => {
        const v = normalize(get(key)); if (!v) return false;
        if (['yes','true','1','sim','x','✓','☑','checked'].includes(v)) return true;
        if (['no','false','0','nao','☐','unchecked'].includes(v)) return false;
        throw new Error(`${importFields[key]}: caixa de seleção não reconhecida (${get(key)}).`);
      };
      const v = normalize(get('importance'));
      let importance = 0.65;
      if (v) {
        if (['alta','alto','high','muito importante','3'].includes(v) || /^★{3,}$/.test(v)) importance = 0.95;
        else if (['baixa','baixo','low','1','★'].includes(v)) importance = 0.3;
        else if (!['media','medio','regular','normal','medium','2','★★'].includes(v)) {
          const number = Number(v.replace(',','.'));
          if (Number.isFinite(number) && number >= 0 && number <= 1) importance = number;
          else warnings.push(`Importância “${get('importance')}” mantida como texto; usando Regular.`);
        }
      }
      const content = importedContentSchema.parse({ area: get('area'), topic: get('topic'), title: get('title'), importance,
        source: { status: get('status'), nextStudy: parseStudyDate(get('nextStudy')), priming: check('priming'), studied: check('studied'),
          questions: check('questions'), retrieval: check('retrieval'), rotation: get('rotation'), originalImportance: get('importance'), preserveDate } });
      const key = contentKey(content.area,content.topic,content.title); const duplicate = seen.has(key); seen.add(key);
      return { line: index + 2, content, errors: [], warnings, duplicate };
    } catch (error) {
      return { line: index + 2, content: null, errors: [error instanceof z.ZodError ? 'Preencha Área, Tema e Assunto (até 200 caracteres) e confira os campos.' : (error as Error).message], warnings, duplicate: false };
    }
  });
}
