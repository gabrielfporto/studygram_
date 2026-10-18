# Orientações de aprendizagem — revisão de 18/10/2026

## Evidência e tradução para o produto

Recuperação e prática distribuída têm apoio em revisões, inclusive na educação em saúde. Recuperação deve incluir tentativa sem consulta e conferência/correção. Espaçamento envolve retornar ao mesmo material ao longo do tempo; alternar assuntos na mesma manhã não é evidência de espaçamento adequado. A intercalação tem efeitos dependentes do material e do objetivo, com utilidade para distinguir tipos de problemas; não justifica uma mistura arbitrária de temas.

Referências consultadas:

- Trumble et al. (2024), *Systematic review of distributed practice and retrieval practice in health professions education*. 56 estudos, intervenções heterogêneas; limitações de avaliação e tempo na tarefa. [DOI](https://doi.org/10.1007/s10459-023-10274-3).
- Cepeda et al. (2006), *Distributed practice in verbal recall tasks: A review and quantitative synthesis*. O intervalo entre estudos interage com o horizonte de retenção; não define duração universal de sessão. [DOI](https://doi.org/10.1037/0033-2909.132.3.354).
- Brunmair e Richter (2019), *Similarity matters: A meta-analysis of interleaved learning and its moderators*. Resultados dependem de materiais e condições; não autoriza tratar toda troca de assunto como benéfica. [DOI](https://doi.org/10.1037/bul0000209).
- Dunlosky et al. (2013), *Improving Students' Learning With Effective Learning Techniques*. Recuperação e prática distribuída com alta utilidade geral; nenhuma validação do algoritmo Studygram. [DOI](https://doi.org/10.1177/1529100612453266).

## Mudanças implementadas

- No ciclo usado pela web, a seleção deixou de maximizar a soma de utilidades de várias atividades curtas. Usa prioridade e encaixe nas janelas, com até três competências e uma preparação por plano. Práticas que já ultrapassaram preparação vêm antes de novas preparações; depois, prioridade e desempate por ID. Não é necessário ocupar toda a disponibilidade.
- Recuperação deixou de ter dez minutos fixos: usa `max(10, reviewMinutes)`, respeitando o esforço da competência. A duração de revisão pode ser ajustada nos parâmetros em Conteúdos. Continuam sendo estimativas de produto, sem inferência automática da complexidade clínica pelo título.
- O começo voluntário de cinco minutos gera uma única atividade. É apoio para iniciar, não uma dose de aprendizagem comprovada.
- A sessão permite definir um objetivo curto e opcional, guardado no rascunho ativo, tentar sem consulta, conferir, corrigir e aplicar. Após o timer, continuar no mesmo assunto mantém o tempo efetivo e a sessão, inclusive retomando uma pausa. Não altera duração prevista, não conclui etapas nem atualiza memória automaticamente.
- Hoje e sessão guiada mostram referências e limites. Conteúdo importado não passa a representar domínio, e FSRS não é tratado como medida de compreensão ou competência clínica.

## Limites e validação necessária

Três assuntos, uma preparação, mínimo de dez minutos e a precedência por etapa são decisões de produto para reduzir fragmentação, não protocolos cientificamente validados. Podem deixar revisões pendentes, sobretudo com grande catálogo, e devem ser ajustados conforme uso real. A seleção é refeita após registros e não impõe um máximo diário absoluto de três assuntos.

O caminho legado de simulação sem `useStudyCycle` continua usando a otimização anterior para comparação; o produto web usa `cycle-2`. Simulações legadas e testes de invariantes não comprovam eficácia pedagógica do ciclo novo. Testes específicos cobrem fragmentação, precedência sobre quantidade, duração configurada, início curto, datas de revisão, limites de capacidade e ausência de gravação ao continuar. A utilidade pedagógica precisa ser avaliada pelo aprendizado posterior, e não pela quantidade de sessões concluídas.

Não há avaliação automática do objetivo escrito, geração de conteúdo clínico ou nova alteração de regras do FSRS nesta entrega. Dificuldade leva a orientação para retomar o material, sem transformar releitura em evidência de recuperação.
