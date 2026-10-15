import type { AIRequest,AICandidate,AIProposal } from '../application/ai.js';
// O provedor é substituível; o núcleo recebe apenas propostas validadas.
export interface AIService {
  propose(request:AIRequest,candidates:AICandidate[]):Promise<{proposal:AIProposal;inputTokens:number;outputTokens:number}>;
}
export interface CalendarSource {
  readBusyWindows(from: Date, to: Date): Promise<{ start: Date; end: Date; status: 'busy' | 'free' | 'cancelled' }[]>;
}
