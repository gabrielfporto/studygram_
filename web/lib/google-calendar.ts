import { calendarListSchema, normalizeFreeBusy, type CalendarChoice } from '../../src/application/calendar';
import { supabase } from './client';
import { localDay } from './planning';
export const GOOGLE_SCOPES=['https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events.freebusy'];
type TokenResponse={access_token?:string;expires_in?:number;error?:string};
interface GoogleIdentity { accounts:{oauth2:{initTokenClient:(config:{client_id:string;scope:string;include_granted_scopes:boolean;callback:(response:TokenResponse)=>void;error_callback:()=>void})=>{requestAccessToken:(options:{prompt:string})=>void};hasGrantedAllScopes:(response:TokenResponse,...scopes:string[])=>boolean;revoke:(token:string,callback:(result:{successful?:boolean})=>void)=>void}} }
declare global { interface Window { google?:GoogleIdentity } }
let loading:Promise<void>|null=null;
export function loadGoogleIdentity():Promise<void>{
  if(window.google?.accounts.oauth2)return Promise.resolve();
  if(loading)return loading;
  loading=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');const failed=()=>{clearTimeout(timeout);loading=null;script.remove();reject(new Error('Não foi possível carregar a conexão com o Google. Tente novamente.'));};const timeout=setTimeout(failed,15000);script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>{if(window.google?.accounts.oauth2){clearTimeout(timeout);resolve();}else failed();};script.onerror=failed;document.head.append(script);});
  return loading;
}
// Tokens ficam somente na memória da aba. Não são gravados no banco, em URLs ou em localStorage.
let owner='';let token='';let expires=0;let generation=0;let calendars:CalendarChoice[]=[];
export function clearGoogleSession(){owner='';token='';expires=0;calendars=[];generation++;}
export function hasGoogleToken(userId:string){return owner===userId&&!!token&&Date.now()<expires-60000;}
export function cachedCalendars(userId:string){return hasGoogleToken(userId)?calendars:[];}
export function authorizeGoogle(userId:string,clientId:string):Promise<void>{
  const oauth=window.google?.accounts.oauth2;if(!oauth)return Promise.reject(new Error('A conexão com o Google ainda está carregando.'));
  if(owner!==userId)clearGoogleSession();owner=userId;const requestGeneration=++generation;
  return new Promise((resolve,reject)=>{const client=oauth.initTokenClient({client_id:clientId,scope:GOOGLE_SCOPES.join(' '),include_granted_scopes:false,
    callback:response=>{if(requestGeneration!==generation){reject(new Error('A conta do Studygram mudou. Conecte novamente.'));return;}
      if(response.error||!response.access_token||!oauth.hasGrantedAllScopes(response,...GOOGLE_SCOPES)){reject(new Error('Autorize a leitura das agendas e dos horários ocupados para continuar.'));return;}
      token=response.access_token;expires=Date.now()+Number(response.expires_in??3600)*1000;resolve();},
    error_callback:()=>reject(new Error('A conexão foi fechada ou o pop-up foi bloqueado. Tente conectar novamente.'))});
    client.requestAccessToken({prompt:'select_account'});
  });
}
async function googleRequest(userId:string,path:string,body?:unknown){
  if(!hasGoogleToken(userId))throw new Error('Autorize o Google novamente para atualizar a agenda.');
  const requestGeneration=generation;
  const response=await fetch(`https://www.googleapis.com/calendar/v3/${path}`,{signal:AbortSignal.timeout(15000),method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(requestGeneration!==generation||owner!==userId)throw new Error('A conta mudou durante a consulta. Tente novamente.');
  if(response.status===401){token='';expires=0;throw new Error('A autorização expirou. Conecte o Google novamente.');}
  if(!response.ok)throw new Error(response.status===403?'O Google não liberou a consulta. Confira as permissões e a ativação da Calendar API.':'Não foi possível consultar o Google Calendar. O último estado foi preservado.');
  return response.json();
}
export async function listGoogleCalendars(userId:string):Promise<CalendarChoice[]>{
  const result:CalendarChoice[]=[];let pageToken:string|undefined;let pages=0;
  do{const query=new URLSearchParams({maxResults:'250',minAccessRole:'freeBusyReader',fields:'items(id,summary,primary,deleted),nextPageToken'});if(pageToken)query.set('pageToken',pageToken);
    const validated=calendarListSchema.safeParse(await googleRequest(userId,`users/me/calendarList?${query}`));if(!validated.success)throw new Error('O Google retornou uma lista de agendas inválida. Tente novamente.');const page=validated.data;result.push(...page.items.filter(c=>!c.deleted));pageToken=page.nextPageToken;
    if(result.length>2500||++pages>10)throw new Error('Há agendas demais nesta conta ou a consulta não terminou. Tente outra conta.');
  }while(pageToken);
  calendars=result;return result;
}
export async function syncGoogleCalendar(userId:string,selected:CalendarChoice[],timezone:string,now=new Date()){
  const requestGeneration=generation;
  const day=localDay(now,timezone);const from=day.toZonedDateTime(timezone).toInstant().toString();const to=day.add({days:14}).toZonedDateTime(timezone).toInstant().toString();
  const raw=await googleRequest(userId,'freeBusy',{timeMin:from,timeMax:to,timeZone:timezone,calendarExpansionMax:10,items:selected.map(c=>({id:c.id}))});
  const snapshot=normalizeFreeBusy(raw,selected,from,to);
  if(requestGeneration!==generation||!hasGoogleToken(userId))throw new Error('A conta mudou ou a autorização expirou. Conecte novamente.');
  const {error}=await supabase.rpc('save_calendar_snapshot',{p_snapshot:snapshot});if(error)throw new Error('A consulta funcionou, mas não foi possível salvar a agenda. Tente atualizar novamente.');
  return snapshot;
}
export async function revokeGoogle(userId:string):Promise<boolean>{
  if(owner!==userId)return false;
  const access=owner===userId?token:'';clearGoogleSession();
  if(!access||!window.google?.accounts.oauth2)return false;
  return new Promise(resolve=>{const timeout=setTimeout(()=>resolve(false),8000);window.google!.accounts.oauth2.revoke(access,response=>{clearTimeout(timeout);resolve(response.successful===true);});});
}
