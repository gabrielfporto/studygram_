# Simulação do motor de estudos

50 temas · 150 competências · 60 dias por cenário · seeds 42, 7 e 2026. Datas sintéticas a partir de 15/10/2026, fuso America/Bahia.

Motor: priority-1.0/planner-1.0. Memória: ts-fsrs@5.4.2/retention-0.9/v1. FSRS real; comportamento do aluno fictício. Não é evidência de eficácia educacional.

## Resultados

| Seed | Sessões | Min planejados/reais | Competências praticadas | Retenção final estimada | Competências <90% | Invariantes |
|---|---:|---:|---:|---:|---:|---:|
| 42 | 267 | 3180/2720 | 92/150 | 95.3% | 3 | 834 |
| 7 | 267 | 3180/2550 | 94/150 | 95.2% | 5 | 834 |
| 2026 | 267 | 3180/2615 | 97/150 | 95.7% | 4 | 834 |

## O que foi verificado

- Nenhum plano ultrapassou a capacidade diária, as janelas ou o orçamento de 360 minutos por ciclo de sete dias.
- Sem repetição de competência no mesmo plano; máximo observado: 6 sessões/dia.
- Os candidatos adiados são recalculados e limitados pelo catálogo (máximo observado 150); não há cópia de tarefas vencidas.
- Três faltas consecutivas nos dias 9–11, dias curtos/livres, descanso, compromisso, respostas erradas, sessões parciais e troca de rodízio no dia 31 foram incluídos.
- Cenário 42: 214 sessões concluídas, 26 parciais e 27 não realizadas.
- Práticas em importância alta/baixa: 149/52, com 50 competências em cada grupo. Não é comparação controlada: contexto e estado também variam.
- 10 práticas do próximo contexto antes da troca; o teste pareado verifica separadamente o bônus de antecipação.

## Limites encontrados

58 competências não foram praticadas nesta janela. 3 ficaram abaixo da meta de retenção estimada no último dia. O sistema limita carga, mas não elimina demanda nem garante retenção quando falta tempo. A Home futura precisa apresentar risco/cobertura sem transformar isso em dívida de tarefas.

A mochila é otimizada por janela; o resultado não é um ótimo global semanal. A métrica de retenção exclui competências nunca estudadas. O aluno sintético usa a retenção FSRS como uma entrada para respostas, portanto não valida a calibração do próprio FSRS. As competências agregadas e os pesos precisam de acompanhamento real.

## Trajetória — seed 42

| Dia | Contexto | Capacidade | Planejado | Real | Sessões | Em risco |
|---|---|---:|---:|---:|---:|---:|
| 1 | MFC | 60 | 60 | 50 | 6 | 0 |
| 2 | MFC | 30 | 30 | 30 | 3 | 0 |
| 3 | MFC | 105 | 90 | 45 | 6 | 0 |
| 4 | MFC | 40 | 40 | 40 | 4 | 0 |
| 5 | MFC | 60 | 60 | 55 | 6 | 0 |
| 6 | MFC | 140 | 90 | 85 | 6 | 0 |
| 7 | MFC | 0 | 0 | 0 | 0 | 1 |
| 8 | MFC | 60 | 60 | 45 | 6 | 0 |
| 9 (falta) | MFC | 30 | 30 | 0 | 3 | 0 |
| 10 (falta) | MFC | 105 | 90 | 0 | 6 | 0 |
| 11 (falta) | MFC | 40 | 40 | 0 | 4 | 1 |
| 12 | MFC | 60 | 60 | 55 | 6 | 4 |
| 13 | MFC | 165 | 90 | 90 | 6 | 5 |
| 14 | MFC | 0 | 0 | 0 | 0 | 8 |
| 15 | MFC | 60 | 60 | 55 | 6 | 6 |
| 16 | MFC | 30 | 30 | 30 | 3 | 7 |
| 17 | MFC | 105 | 90 | 80 | 6 | 5 |
| 18 | MFC | 40 | 40 | 40 | 4 | 4 |
| 19 | MFC | 60 | 60 | 50 | 6 | 3 |
| 20 | MFC | 105 | 90 | 70 | 6 | 2 |
| 21 | MFC | 0 | 0 | 0 | 0 | 5 |
| 22 | MFC | 60 | 60 | 50 | 6 | 6 |
| 23 | MFC | 30 | 30 | 30 | 3 | 6 |
| 24 | MFC | 105 | 90 | 90 | 6 | 6 |
| 25 | MFC | 40 | 40 | 40 | 4 | 7 |
| 26 | MFC | 60 | 60 | 60 | 6 | 5 |
| 27 | MFC | 90 | 90 | 85 | 6 | 4 |
| 28 | MFC | 0 | 0 | 0 | 0 | 7 |
| 29 | MFC | 60 | 60 | 60 | 6 | 3 |
| 30 | MFC | 30 | 30 | 25 | 3 | 1 |
| 31 | Emergência | 105 | 90 | 80 | 6 | 1 |
| 32 | Emergência | 40 | 40 | 40 | 4 | 1 |
| 33 | Emergência | 60 | 60 | 50 | 6 | 3 |
| 34 | Emergência | 105 | 90 | 90 | 6 | 2 |
| 35 | Emergência | 0 | 0 | 0 | 0 | 4 |
| 36 | Emergência | 60 | 60 | 55 | 6 | 5 |
| 37 | Emergência | 30 | 30 | 30 | 3 | 7 |
| 38 | Emergência | 105 | 90 | 85 | 6 | 10 |
| 39 | Emergência | 40 | 40 | 35 | 4 | 11 |
| 40 | Emergência | 60 | 60 | 45 | 6 | 10 |
| 41 | Emergência | 110 | 90 | 70 | 6 | 8 |
| 42 | Emergência | 0 | 0 | 0 | 0 | 10 |
| 43 | Emergência | 60 | 60 | 45 | 6 | 9 |
| 44 | Emergência | 30 | 30 | 30 | 3 | 9 |
| 45 | Emergência | 105 | 90 | 90 | 6 | 9 |
| 46 | Emergência | 40 | 40 | 40 | 4 | 11 |
| 47 | Emergência | 60 | 60 | 50 | 6 | 12 |
| 48 | Emergência | 105 | 90 | 90 | 6 | 11 |
| 49 | Emergência | 0 | 0 | 0 | 0 | 12 |
| 50 | Emergência | 60 | 60 | 55 | 6 | 12 |
| 51 | Emergência | 30 | 30 | 30 | 3 | 11 |
| 52 | Emergência | 105 | 90 | 90 | 6 | 7 |
| 53 | Emergência | 40 | 40 | 40 | 4 | 6 |
| 54 | Emergência | 60 | 60 | 55 | 6 | 7 |
| 55 | Emergência | 90 | 90 | 80 | 6 | 5 |
| 56 | Emergência | 0 | 0 | 0 | 0 | 6 |
| 57 | Emergência | 60 | 60 | 35 | 6 | 4 |
| 58 | Emergência | 30 | 30 | 30 | 3 | 4 |
| 59 | Emergência | 105 | 90 | 80 | 6 | 1 |
| 60 | Emergência | 40 | 40 | 40 | 4 | 3 |

## Exemplos explicáveis — mesmo catálogo inicial

### Janela de 30 minutos

Selecionado: 30 min em 3 sessões.

| Tema / competência | Método | Min | Score | Valor/min | Motivos |
|---|---|---:|---:|---:|---|
| Osteoporose / Reconhecimento | recall | 10 | 44.2 | 2.87 | Relevante para o contexto atual; Alta importância |
| HAS / Reconhecimento | recall | 10 | 43.9 | 2.85 | Relevante para o contexto atual; Alta importância |
| DM2 / Reconhecimento | recall | 10 | 43.5 | 2.83 | Relevante para o contexto atual; Alta importância |

### Janela de 180 minutos

Selecionado: 180 min em 6 sessões.

| Tema / competência | Método | Min | Score | Valor/min | Motivos |
|---|---|---:|---:|---:|---|
| DM2 / Manejo inicial | new | 40 | 45.0 | 1.57 | Memória ainda não avaliada; Dificuldade e erros recentes; Relevante para o contexto atual |
| Hipotireoidismo / Manejo inicial | new | 40 | 45.0 | 1.57 | Memória ainda não avaliada; Dificuldade e erros recentes; Relevante para o contexto atual |
| Obesidade / Manejo inicial | new | 40 | 45.0 | 1.57 | Memória ainda não avaliada; Dificuldade e erros recentes; Relevante para o contexto atual |
| Osteoporose / Reconhecimento | questions | 20 | 44.2 | 2.21 | Relevante para o contexto atual; Alta importância |
| HAS / Reconhecimento | questions | 20 | 43.9 | 2.20 | Relevante para o contexto atual; Alta importância |
| DM2 / Reconhecimento | questions | 20 | 43.5 | 2.17 | Relevante para o contexto atual; Alta importância |
