# Importar o cronograma do Notion

Em **Conteúdos → Importar do Notion**, envie o CSV extraído da exportação Markdown e CSV do Notion, ou cole uma tabela com cabeçalho (CSV ou separada por tabulações). A imagem do cronograma serve como referência de formato; os dados completos devem vir do arquivo.

Até 1.000 assuntos / 2 MB por lote. O leitor aceita vírgula, ponto e vírgula, tabulação, BOM UTF-8, células entre aspas e quebras de linha dentro de células. O mapeamento pode ser ajustado antes de confirmar.

| Notion | Studygram |
| --- | --- |
| Área | Área de estudo |
| Tema | Tema dentro da área |
| Assunto | Competência/assunto estudável |
| Importância | Alta 0,95; Regular 0,65; Baixa 0,3. A prévia informa valores não reconhecidos. |
| Rodízio | Vínculos a contextos, separados por vírgula; não altera automaticamente o contexto atual |
| Status e Priming/Estudo/Questões/Retrieval | Histórico de origem consultável no assunto |
| Próximo Estudo | Data original, com opção de elegibilidade inicial |

Área, Tema e Assunto são obrigatórios. Datas aceitam DD/MM/AAAA, AAAA-MM-DD e mês inglês por extenso (ex.: October 6, 2026). Intervalos de datas precisam ser convertidos para uma data inicial. Checkboxes aceitam Yes/No, True/False, Sim/Não, Checked/Unchecked, 1/0 e marcas usuais. Campos opcionais podem ser ignorados no mapeamento.

Na redistribuição adaptativa, todos os assuntos importados ficam elegíveis imediatamente. Se a data inicial for preservada, assuntos futuros entram no plano a partir daquele dia no fuso configurado; datas passadas não se acumulam como tarefas obrigatórias. Após uma sessão não marcada como ausência, o acompanhamento usa o histórico do app. Não há garantia de encaixar todos os assuntos na data original: a disponibilidade continua sendo respeitada.

Estudo, Questões ou Retrieval marcados habilitam uma primeira recuperação, sem criar sessão, acertos, domínio ou cartão FSRS artificial. Priming sozinho não indica estudo concluído. O status fica como texto de histórico. Uma recuperação registrada no Studygram inicia a estimativa de memória.

A prévia permite desmarcar linhas. Linhas inválidas e duplicadas ficam de fora. Corrija os erros no arquivo e importe depois. Duplicatas são identificadas por Área + Tema + Assunto, ignorando caixa, acentos e espaços repetidos, inclusive itens arquivados. O backend repete a conferência sob RLS e trava por usuário: o lote é atômico e uma tentativa repetida não duplica conteúdos. A importação adiciona assuntos; mudanças no CSV não substituem registros existentes. Não há sincronização contínua com o Notion.

Validação: testes do leitor, interação da prévia/retry/seleção, datas por fuso, planejamento sem evidência inventada e PostgreSQL real com RLS, isolamento, rollback e reimportação.
