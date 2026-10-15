# Fase 4 — Assistente de estudo

## Fluxos implementados

O botão **Assistente de estudo** fica no topo do app, sem criar uma quinta área de navegação.

1. **Registrar estudo:** descreva o estudo. A IA sugere uma competência entre até 12 candidatas, duração, método e questões/acertos. Dados ausentes ficam desconhecidos, sem inventar zero acertos nem feedback. A prévia abre o formulário editável; o usuário confirma competência, duração, término no fuso do perfil e resultado. Só a gravação da sessão atualiza o histórico/FSRS pelo serviço existente.
2. **Organizar conteúdo:** a partir de texto, sugere uma área, um tema e até 12 competências. Os campos podem ser editados e linhas removidas. A confirmação usa `import_schedule`, atômico e com deduplicação. Não fabrica sessões ou etapas estudadas.
3. **Organizar erro:** reescreve o erro e sugere competência e classificação. O usuário pode trocar o vínculo e editar os textos antes de confirmar a inclusão no caderno. Não modifica memória nem cria questões.
4. **Recuperação ativa:** exige uma competência e um trecho de material com pelo menos 80 caracteres. Gera pergunta, resposta sugerida e citação verificável do trecho. O usuário responde antes de revelar a comparação; a IA não dá nota. O registro de recuperação exige duração e feedback do próprio usuário. Nenhum conteúdo é buscado em URLs externas.

Cada ação é explícita; nada é gerado ao abrir a página. Mudar de ação descarta a prévia ainda não salva. Fechar a aba não preserva o rascunho de IA.

## Servidor e configuração

- `study-ai`: Edge Function com `auth.getUser` antes de acessar dados ou chamar o provedor. IDs de competências são revalidados por `user_id`, inclusive quando o cliente os fornece. Não aceita uma competência arquivada ou de outra conta.
- `OPENAI_API_KEY`: secret exclusivo do Supabase, confirmado como configurado pelo usuário. Nunca deve entrar em variável `VITE_`, código público, formulário ou conversa.
- `AI_PROVIDER`: `openai` (padrão). Outros provedores exigem um adaptador que implemente o contrato `AIService`; valores não suportados são rejeitados.
- `AI_MODEL_SIMPLE`: nome do modelo da conta OpenAI. Padrão da entrega: `gpt-5.6-terra`. Trocar essa variável não exige mudança de código. Não há rota automática para modelo mais caro. `AI_MODEL_COMPLEX` permanece reservado para uma evolução futura.
- `npm run build:edge`: gera os bundles de `study-session` e `study-ai`; publicar somente a função alterada.

**Estado de ativação:** código e migration publicados; a configuração `Verify JWT with legacy secret` da nova função permanece ligada. A revisão automática rejeitou desligá-la sem autorização específica. O código faz validação remota de sessão pelo Supabase Auth, mas a alteração dessa configuração precisa de aprovação antes do teste real completo. Não foi contornada por headers alternativos ou outra rota.

## Limites de uso e cache

Antes de cada consulta externa, `reserve_ai_request` reserva uma tentativa em transação, com lock para concorrência. Apenas `service_role` executa essa função; clientes não podem modificar métricas nem reservas.

- Até **10 novas consultas por conta por dia UTC**.
- Até **3 novas consultas por conta por minuto**.
- Até **100 novas consultas por dia UTC no projeto**.
- Texto de entrada até **6.000 caracteres**, até **12 competências** relevantes e saída limitada a **2.400 tokens**. Timeout externo de 45 segundos.
- Falhas também consomem uma tentativa, evitando repetição ilimitada com custo. Não há retry automático do provedor.
- Repetições idênticas usam cache por usuário/operação/modelo/contexto/versão/variação por 24 horas. Solicitações paralelas iguais são bloqueadas enquanto há uma pendente recente.
- “Gerar outra sugestão” incrementa a variação e pode consumir nova consulta. Alterar o texto volta à variação inicial.

Esses são limites de requisições e tokens, não uma garantia de teto monetário. O valor depende do modelo e da conta do provedor; configure também os alertas/controles de gasto no projeto OpenAI. As contagens de tokens em `ai_usage` representam respostas bem-sucedidas; falhas podem ter consumo no provedor mesmo quando não há token contabilizado localmente.

## Dados e revisão

Somente o texto digitado e os nomes das competências candidatas vão para a OpenAI. Nunca são enviados calendário, e-mail, histórico inteiro, material de URLs ou credenciais. O texto e os títulos são tratados como dados não confiáveis; a geração não tem ferramentas para executar comandos. Structured Outputs e validação local rejeitam IDs inventados, acertos incompatíveis, resultados incompletos e citações que não aparecem no trecho.

As respostas são solicitadas com `store:false`. Isso não equivale a prometer ausência de retenção pelo provedor. O prompt original não é persistido pelo app. A proposta pode conter trechos do texto e fica no cache protegido por RLS; após 24 horas deixa de ser reutilizada e o conteúdo é limpo na próxima reserva feita pela conta. Métricas de uso permanecem.

Dados de pacientes não devem ser enviados. As perguntas são apoio ao estudo do material fornecido, não recomendações clínicas. A existência de uma citação não garante que a interpretação esteja correta: o usuário deve conferir a resposta sugerida.

## Validação

Testes de contrato/provedor com transporte simulado, autenticação e posse no handler, PostgreSQL local com RLS/cotas/cache, confirmação antes de gravar, campos desconhecidos e tentativa antes de revelar resposta. O teste com a OpenAI real e a confirmação de funcionamento em produção permanecem pendentes da configuração JWT e de uma sessão autenticada na aba do app.

Documentação oficial: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [modelo padrão](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [secrets do Supabase](https://supabase.com/docs/guides/functions/secrets).
