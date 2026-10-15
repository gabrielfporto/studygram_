import { z } from 'zod';
import { mergeWindows } from '../engine/availability.js';
const instant=z.iso.datetime({offset:true});
export const calendarChoiceSchema=z.object({id:z.string().min(1).max(1024),summary:z.string().default('Agenda'),primary:z.boolean().optional(),deleted:z.boolean().optional()});
export type CalendarChoice=z.infer<typeof calendarChoiceSchema>;
export const calendarListSchema=z.object({items:z.array(calendarChoiceSchema).default([]),nextPageToken:z.string().optional()});
const googleBusySchema=z.object({calendars:z.record(z.string(),z.object({errors:z.array(z.unknown()).optional(),busy:z.array(z.object({start:instant,end:instant})).optional()}))});
export interface CalendarSnapshot { from:string; to:string; calendars:{id:string;name:string}[]; busy:{calendarId:string;start:string;end:string}[] }
export function normalizeFreeBusy(raw:unknown,selected:CalendarChoice[],from:string,to:string):CalendarSnapshot {
  if(selected.length<1||selected.length>10||new Set(selected.map(c=>c.id)).size!==selected.length)throw new Error('Escolha entre uma e dez agendas diferentes.');
  const min=Date.parse(from),max=Date.parse(to);
  if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min||max-min>31*86400000)throw new Error('Intervalo de agenda inválido.');
  const validated=googleBusySchema.safeParse(raw);
  if(!validated.success)throw new Error('A consulta retornou dados incompletos. O último estado da agenda foi preservado.');
  const parsed=validated.data;
  const busy:CalendarSnapshot['busy']=[];
  for(const calendar of selected){
    const result=parsed.calendars[calendar.id];
    if(!result||result.errors?.length||!result.busy)throw new Error('Uma agenda não pôde ser consultada. O último estado foi preservado. Confira suas permissões e tente novamente.');
    const periods=result.busy.map(b=>{const start=Date.parse(b.start),end=Date.parse(b.end);if(end<=start)throw new Error('O Google retornou um intervalo inválido.');return{start:Math.max(start,min),end:Math.min(end,max)};}).filter(b=>b.end>b.start);
    for(const b of mergeWindows(periods))busy.push({calendarId:calendar.id,start:new Date(b.start).toISOString(),end:new Date(b.end).toISOString()});
  }
  if(busy.length>10000)throw new Error('A agenda retornou intervalos demais. Selecione menos agendas.');
  return {from:new Date(min).toISOString(),to:new Date(max).toISOString(),calendars:selected.map(c=>({id:c.id,name:c.summary.slice(0,200)})),busy};
}
