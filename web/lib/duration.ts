export function durationLabel(minutes:number):string {
  if(!minutes) return 'Descanso';
  const hours=Math.floor(minutes/60), rest=minutes%60;
  return [hours?`${hours} h`:'',rest?`${rest} min`:''].filter(Boolean).join(' ');
}
export function windowCapacity(start:string,end:string):number {
  const parse=(time:string)=>{const [h,m]=time.split(':').map(Number);return (h??0)*60+(m??0);};
  const duration=parse(end)-parse(start);
  return duration>0 ? Math.min(720,Math.floor(duration/5)*5) : 720;
}
