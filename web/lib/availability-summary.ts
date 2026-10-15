import type { StudyData } from './data';
import { localDay,dayWindow } from './planning';
import { availability,mergeWindows } from '../../src/engine/availability';
import { MINUTE } from '../../src/domain/model';

export function availabilitySummary(data:StudyData,now:Date,offset=0) {
  const timezone=data.profile?.timezone??'America/Bahia';const date=localDay(now,timezone).add({days:offset});
  const start=dayWindow(date,'00:00',timezone);const end=dayWindow(date.add({days:1}),'00:00',timezone);
  const cursor=new Date(Math.max(start,now.getTime()));
  const rules=data.rules.filter(r=>r.weekday===date.dayOfWeek%7);
  const windows=rules.map(r=>({start:dayWindow(date,r.starts_local,timezone),end:dayWindow(date,r.ends_local,timezone)}));
  const connected=new Set(data.calendar?.connections.filter(c=>c.status==='connected').map(c=>c.id));
  const busy=mergeWindows((data.calendar?.events??[]).filter(e=>connected.has(e.connection_id)&&e.status==='busy'&&Date.parse(e.ends_at)>cursor.getTime()&&Date.parse(e.starts_at)<end).map(e=>({start:Math.max(cursor.getTime(),Date.parse(e.starts_at)),end:Math.min(end,Date.parse(e.ends_at))}))).map(w=>({...w,status:'busy' as const}));
  const free=availability(windows,busy,cursor,5);const original=availability(windows,[],cursor,5);
  const sum=(list:typeof free)=>Math.floor(list.reduce((n,w)=>n+(w.end-w.start)/MINUTE,0));
  const spent=data.sessions.filter(s=>localDay(new Date(s.started_at),timezone).equals(date)).reduce((n,s)=>n+s.actual_minutes,0);
  const cap=Math.max(0,Math.max(0,...rules.map(r=>r.daily_cap_minutes))-spent);
  const withoutCalendar=Math.min(cap,sum(original));const available=Math.min(cap,sum(free));
  const overlap=Math.max(0,sum(original)-sum(availability(windows,busy,cursor,1)));
  const covered=!!connected.size&&(data.calendar?.connections.filter(c=>connected.has(c.id)).every(c=>c.sync_range_start&&c.sync_range_end&&Date.parse(c.sync_range_start)<=start&&Date.parse(c.sync_range_end)>=end)??false);
  return {date,timezone,start,end,busy,free,spent,available,withoutCalendar,overlap,lost:withoutCalendar-available,covered};
}
