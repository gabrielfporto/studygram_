// Contratos futuros: nenhuma integração fictícia é oferecida como serviço funcional.
export interface StudyLogProposal {
  minutes: number; competencyIds: string[]; method: 'reading' | 'recall' | 'questions';
  confidence: number; needsConfirmation: boolean;
}
export interface RelevantContext { competencies: { id: string; title: string }[] }
export interface AIService {
  interpretStudyLog(text: string, context: RelevantContext): Promise<StudyLogProposal>;
  generateRecallQuestion(competencyId: string, context: string): Promise<{ question: string; rubric: string }>;
  classifyError(text: string, context: RelevantContext): Promise<{ competencyId: string; confidence: number }>;
  analyzePerformance(summary: string): Promise<{ observations: string[] }>;
  explainPriority(factors: Record<string, number>): Promise<string>;
  suggestCompetencies(topic: string): Promise<{ titles: string[] }>;
}
export interface CalendarSource {
  readBusyWindows(from: Date, to: Date): Promise<{ start: Date; end: Date; status: 'busy' | 'free' | 'cancelled' }[]>;
}
