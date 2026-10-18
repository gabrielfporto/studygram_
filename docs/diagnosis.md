# Diagnóstico de estudo

Disponível em **Progresso → Diagnóstico**. Usa regras locais, sem chamadas à IA, novos dados enviados ao servidor ou mudanças no FSRS. A janela inclui hoje e os 13 dias anteriores no fuso do perfil, excluindo registros futuros; usa o término da sessão quando disponível.

O painel também exibe as referências diárias do plano guardadas neste navegador, com comparação do estudo iniciado após cada captura. Não há referências retroativas, nem sincronização desses snapshots entre dispositivos. Consulte [validação diária](daily-validation.md) para o critério de comparação e os limites de armazenamento.

Os indicadores mostram dias com prática, minutos, sessões parciais e tempo realizado versus previsto. A comparação de tempo inclui somente sessões com `planned_minutes` registrado; sessões manuais sem previsão não recebem uma duração inventada. Não compara o realizado com toda a disponibilidade ou com planos passados que não foram registrados. Sessões parciais não são interpretadas como interrupção, nem dias sem registro como ausência de estudo.

Até três ações são exibidas. Sinais da mesma competência são reunidos em um cartão, na ordem do cadastro, excluindo competências arquivadas:

- Duas recuperações mais recentes com feedback 1 ou 2. Exclui leitura, preparação, ausência e questões sem tentativas vinculadas.
- Menos de 70% de acerto em pelo menos dez questões e dois registros, com ressalva de dificuldade variável.
- Dois erros ainda abertos com a mesma classificação ou descrição normalizada.
- Comparação de duração: pelo menos oito sessões com previsão, três em cada grupo (até 15 minutos ou maiores), e taxa de conclusão dos blocos curtos ao menos 25 pontos percentuais superior. É associação, não causa.

Quando os critérios não são atingidos, o painel comunica evidência insuficiente sem declarar domínio. As ações iniciam uma sessão guiada de recuperação de cinco minutos, abrem Plano → Rotina para revisão, ou abrem um registro manual. Uma sessão em andamento bloqueia outra ação do diagnóstico. Abrir o painel não modifica o plano, nem salva registros.

Validação automatizada cobre amostra mínima, datas futuras/antigas, limite de dia no fuso local, leitura/ausência, recuperação recente, erros resolvidos, dados sem previsão e acionamento explícito na interface. Validação visual contempla desktop e mobile.
