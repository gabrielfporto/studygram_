# Fase 5 — validação do uso diário

## Entrega inicial

- Rotina e registro de estudo têm rascunhos locais por conta. Alterar um campo guarda o rascunho por até 30 dias desde a última edição. Fechar, trocar de aba do app ou recarregar não envia o registro à conta. A gravação confirmada limpa o rascunho; falhas preservam os campos e a chave de idempotência. Há descarte explícito.
- O formulário de resultado da sessão guiada usa a chave da própria sessão; o timer continua usando o mecanismo anterior de retomada. A sugestão da IA não substitui um rascunho manual.
- Em Hoje, o primeiro plano não vazio exibido por dia/fuso é guardado como referência. Recálculos não o substituem. As últimas 90 referências ficam neste navegador, separadas por conta, com IDs/métodos/durações e versão do motor, sem notas nem credenciais. Uma referência não é compromisso de execução.
- Em Diagnóstico, a comparação mostra apenas os dias com referência dos últimos 14 dias no fuso atual. O realizado é o tempo de sessões iniciadas depois da captura, no mesmo dia, com término já ocorrido, excluindo IDs que já existiam ao capturar. Inclui estudo de outros conteúdos e não indica conclusão das atividades previstas. Não compara tempo anterior à captura com uma previsão feita depois.

Esses dados locais não sincronizam entre dispositivos e podem ser perdidos ao limpar dados do site. Sair da conta mantém os rascunhos para a próxima entrada da mesma conta neste navegador. Erro ao gravar localmente aparece na interface; não há confirmação fictícia de persistência. O registro de estudo salvo na conta continua usando o servidor existente. Importação, formulários de conteúdo/erros/provas, sugestões da IA e ajustes rápidos de tempo ainda não têm essa recuperação de rascunho.

## Validação prática sugerida

Durante cinco dias de uso real:

1. Abra Hoje, escolha o próximo passo e use o começo de cinco minutos quando ajudar.
2. Registre o que aconteceu, inclusive um avanço parcial. Não registre ausência só porque esqueceu de abrir o app.
3. Se interromper um preenchimento, feche e reabra o formulário para conferir o rascunho antes de salvar.
4. Ao final, abra Diagnóstico e veja as referências disponíveis. Falta de evidência não significa que o método não funcionou.

O que observar: ficou mais fácil começar? O próximo passo estava claro? Qual tela fez você desistir ou procurar outra ferramenta? Essas respostas orientam o refinamento, sem exigir mais preenchimentos durante o estudo.

Próximas entregas da fase 5: ampliar rascunhos conforme o uso, acessibilidade com tecnologias assistivas, monitoramento de falhas com dados mínimos e sincronização/offline. Esta entrega não conclui toda a fase 5.
