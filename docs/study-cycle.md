# Um próximo passo executável

O Studygram usa seu material externo e acompanha **Preparação → Teoria → Recuperação → Questões → Revisões**. As etapas importadas do Notion continuam sendo reconhecidas. Cada atividade de Hoje tem um objetivo, um primeiro movimento e uma sequência curta de instruções. As demais atividades ficam recolhidas para manter o foco em uma escolha.

- Preparação: localizar o material e anotar uma pergunta, 5 minutos.
- Teoria: estudar um bloco e registrar onde continuar, normalmente 25 minutos.
- Recuperação: explicar sem consulta e conferir as lacunas, 10 minutos.
- Questões: praticar no próprio banco/material e registrar tentativas e acertos.
- Após o ciclo inicial: acompanhar a memória. Revisões futuras aguardam sua data, sem preencher toda folga com repetição do mesmo assunto.

“Começar com 5 min” reduz o bloco do assunto escolhido. “Tenho só 5 minutos” cria uma janela explícita a partir de agora e recalcula o plano. Um bloco curto não conclui a etapa automaticamente. No fechamento, a opção inicial é **Avancei, vou retomar**; o usuário informa se de fato concluiu o objetivo. Uma etapa parcial permanece disponível, o tempo é contabilizado e a observação mais recente reaparece no próximo encontro com o assunto.

Concluir uma etapa libera a seguinte no mesmo dia, respeitando a disponibilidade restante. Preparações têm utilidade menor que o avanço da teoria no otimizador, para evitar uma fila de primeiros contatos sem aprofundamento. O modo de simulação anterior permanece como baseline do motor; a interface usa a política `cycle-1`, coberta por testes próprios.

Sessões guiadas têm instruções, link opcional para o material, timer e pausa. O timer não grava resultados nem conclui etapas sozinho. Ao abrir o registro, ele pausa; o tempo real pode ser corrigido. O rascunho de sessão, incluindo chave de idempotência, fica no armazenamento local por usuário e pode ser retomado neste navegador após minimizar ou recarregar. As respostas ainda não salvas do formulário final não são persistidas. O timer continua enquanto a aba estiver fora de foco: é possível estudar no material externo. Confirme o tempo efetivo ao voltar.

Em Conteúdos, cada assunto pode receber um link http/https para sua aula, Notion, PDF ou banco de questões. Links com protocolos executáveis ou credenciais no endereço são recusados pela interface. O banco valida o protocolo e o comprimento, e as políticas de propriedade existentes protegem a atualização.

Preparação e leitura registram tempo e progresso, sem atualizar FSRS. Recuperações efetivas podem atualizar memória mesmo quando a etapa ficou parcial. Questões só concluem a etapa com pelo menos uma tentativa registrada. Dados importados não fabricam memória nem acertos.

Limites: o app não fornece conteúdo didático, não corrige respostas livres, não abre arquivos locais automaticamente e não sincroniza o timer entre dispositivos. O histórico salvo e os materiais vinculados acompanham a conta; a sessão em andamento fica neste navegador.
