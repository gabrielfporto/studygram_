import { useEffect, useState } from 'react';
import type { StudyData } from '../lib/data';
import type { CalendarChoice } from '../../src/application/calendar';
import { loadGoogleIdentity,authorizeGoogle,listGoogleCalendars,syncGoogleCalendar,revokeGoogle,cachedCalendars,hasGoogleToken } from '../lib/google-calendar';
import { calendarState } from '../lib/calendar-state';
import { supabase } from '../lib/client';
export const calendarApi={load:loadGoogleIdentity,authorize:authorizeGoogle,list:listGoogleCalendars,sync:syncGoogleCalendar,revoke:revokeGoogle,cached:cachedCalendars,hasToken:hasGoogleToken};
export function CalendarPanel({data,onSaved,clientId=import.meta.env?.VITE_GOOGLE_CLIENT_ID??'',api=calendarApi}:{data:StudyData;onSaved:()=>Promise<void>;clientId?:string;api?:typeof calendarApi}){
  const userId=data.userId??'';const configured=/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
  const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [options,setOptions]=useState<CalendarChoice[]>(()=>api.cached(userId));
  const [selected,setSelected]=useState<string[]>(data.calendar?.connections.filter(c=>c.status==='connected').map(c=>c.external_calendar_id)??[]);
  const state=calendarState(data,new Date());const timezone=data.profile?.timezone??'America/Bahia';
  useEffect(()=>{let alive=true;if(configured)api.load().then(()=>{if(alive)setReady(true);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'O Google não carregou.');});return()=>{alive=false;};},[api,configured]);
  async function connect(){setBusy(true);setError('');setMessage('');try{
    await api.authorize(userId,clientId);const choices=await api.list(userId);setOptions(choices);
    const previous=data.calendar?.connections.filter(c=>c.status==='connected').map(c=>c.external_calendar_id)??[];
    const retained=previous.filter(id=>choices.some(c=>c.id===id));
    const defaults=retained.length?retained:choices.filter(c=>c.primary).slice(0,1).map(c=>c.id);setSelected(defaults);
    if(previous.length && retained.length===previous.length){await api.sync(userId,choices.filter(c=>retained.includes(c.id)),timezone);await onSaved();setMessage('Agenda atualizada. Seu plano já considera os horários ocupados.');}
    else setMessage(choices.length?'Escolha as agendas e confirme a sincronização.':'Esta conta não retornou agendas acessíveis. Tente outra conta Google.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível conectar.');}finally{setBusy(false);}}
  async function sync(){setBusy(true);setError('');setMessage('');try{
    await api.sync(userId,options.filter(c=>selected.includes(c.id)),timezone);await onSaved();setMessage('Agenda atualizada. Seu plano foi recalculado.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar a agenda.');}finally{setBusy(false);}}
  async function disconnect(){setBusy(true);setError('');setMessage('');try{
    const {error}=await supabase.rpc('disconnect_calendar');if(error)throw new Error('Não foi possível desconectar. Tente novamente.');
    const revoked=await api.revoke(userId);setOptions([]);setSelected([]);await onSaved();setMessage(revoked?'Agenda desconectada e acesso revogado.':'Agenda desconectada do Studygram. Você também pode remover a autorização na sua Conta Google.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível desconectar.');}finally{setBusy(false);}}
  return <section className="surface calendar-panel" aria-label="Google Calendar"><div className="section-title"><div><p className="eyebrow">SEUS COMPROMISSOS ENTRAM NA CONTA</p><h2>Google Calendar</h2></div><span className="pill">Leitura de disponibilidade</span></div>
    <p className="muted small">Escolha quais agendas o Studygram deve considerar. Os horários ocupados são descontados das suas janelas de estudo.</p>
    <p className="caption">Guardamos apenas os intervalos ocupados e os nomes das agendas selecionadas. Títulos, descrições e participantes dos eventos não são importados. Nenhum evento será criado ou alterado.</p>
    {!configured && <p role="status" className="notice">A conexão com o Google ainda precisa ser ativada para este aplicativo. Seus horários semanais continuam disponíveis acima.</p>}
    {state.connected && <div className="calendar-status"><strong>{state.stale?'Agenda precisa de atualização':'Horários ocupados considerados no plano'}</strong><p className="caption">{state.lastSync?`Última consulta: ${new Date(state.lastSync).toLocaleString('pt-BR',{timeZone:timezone})}`:'Ainda não há uma consulta completa.'}</p>{state.stale && <p className="caption">Os últimos intervalos continuam sendo considerados, mas sua agenda pode ter mudado. Atualize antes de confiar nos espaços livres.</p>}</div>}
    <div className="calendar-actions"><button className="primary" disabled={!configured||!ready||busy||!userId} onClick={()=>void connect()}>{busy?'Aguarde…':options.length?'Autorizar / trocar conta Google':state.connected?'Autorizar Google e atualizar':'Conectar Google Calendar'}</button>{state.connected && <button className="secondary" disabled={busy} onClick={()=>void disconnect()}>Desconectar agenda</button>}{configured&&!ready&&error && <button className="secondary" disabled={busy} onClick={()=>{setError('');api.load().then(()=>setReady(true)).catch(e=>setError(e.message));}}>Tentar carregar Google</button>}</div>
    {!!options.length && <div className="calendar-selection"><h3>Agendas para considerar</h3><p className="caption">Selecione até 10 agendas.</p>{options.map(c=><label className="calendar-check" key={c.id}><input type="checkbox" checked={selected.includes(c.id)} disabled={busy||(!selected.includes(c.id)&&selected.length>=10)} onChange={e=>setSelected(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/><span>{c.summary}{c.primary?' · principal':''}</span></label>)}<button className="secondary" disabled={busy||!selected.length||selected.length>10} onClick={()=>void sync()}>Sincronizar agendas selecionadas</button></div>}
    {configured && <p className="caption">Consultamos os próximos 14 dias. Atualize por este botão quando sua agenda mudar. Após fechar a aba ou expirar a autorização, o Google pode pedir acesso novamente.</p>}
    {message && <p role="status" className="notice">{message}{!options.length&&message.includes('Conta Google')&&<> <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Gerenciar permissões ↗</a></>}</p>}{error && <p role="alert" className="notice error">{error}</p>}
  </section>;
}
