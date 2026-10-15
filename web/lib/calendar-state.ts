import type { StudyData } from './data';
import { localDay } from './planning';
export function calendarState(data:StudyData,now:Date){
  const connections=data.calendar?.connections.filter(c=>c.status==='connected')??[];
  if(!connections.length)return {connected:false,stale:false,lastSync:null as string|null};
  const day=localDay(now,data.profile?.timezone??'America/Bahia');
  const start=day.toZonedDateTime(data.profile?.timezone??'America/Bahia').epochMilliseconds;
  const end=day.add({days:1}).toZonedDateTime(data.profile?.timezone??'America/Bahia').epochMilliseconds;
  const stamps=connections.map(c=>c.last_synced_at?Date.parse(c.last_synced_at):0);
  const oldest=Math.min(...stamps);
  const stale=connections.some(c=>!c.sync_range_start||!c.sync_range_end||Date.parse(c.sync_range_start)>start||Date.parse(c.sync_range_end)<end)||!oldest||now.getTime()-oldest>3600000;
  return {connected:true,stale,lastSync:oldest?new Date(oldest).toISOString():null};
}
