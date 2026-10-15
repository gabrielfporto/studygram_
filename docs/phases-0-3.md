# Entrega das fases 0–3 — MVP web

Atualizado em 15/10/2026. Este documento descreve a entrega web atual; funcionalidades futuras da especificação inicial não são tratadas como implementadas.

| Fase | Entrega | Evidência |
|---|---|---|
| 0 | Domínio, prioridade explicável, disponibilidade, planejamento e FSRS isolados da interface | Dez cenários obrigatórios; simulação de 50 temas/150 competências por 60 dias em três seeds; testes de invariantes e determinismo |
| 1 | Auth, catálogo, edição/arquivo de competências, rotina, contexto, plano diário, sessões orientadas e registro externo com busca | Usuário confirmou registro em produção; testes de interação, persistência, idempotência e RLS com duas contas |
| 2 | FSRS transacional, recuperação ativa, questões/acertos, caderno de erros e progresso | Leitura/ausência não fabricam evidência; erros são vinculados à competência e influenciam prioridade; revisão/reabertura não altera memória; quatro semanas de prática/questões e histórico real |
| 3 | Calendar por usuário, seleção de agendas, sincronização manual, conflitos e capacidade semanal visíveis | Usuário confirmou autorização/sincronização real; testes de transporte, falhas parciais, fusos, sobreposição, cache, desconexão e isolamento |

## Onde encontrar

- **Plano → Semana:** capacidade restante dos próximos sete dias. Abra um dia para ver janelas livres e horários ocupados. Conflito e redução do teto são números distintos: um compromisso pode ocupar a janela sem reduzir o teto de estudo, se ainda houver espaço suficiente.
- **Plano → Rotina:** barras por dia; horários e esforço em controles separados no mobile. O botão de salvar permanece no fluxo da página.
- **Plano → Agenda Google:** número de agendas e intervalos futuros, última consulta e impacto no dia. Sem conflito, o app explica por que o plano não mudou.
- **Plano → Provas e rodízios:** relacionar temas a eventos futuros. Prova vale até o fim do dia no fuso do perfil; rodízio inclui o último dia. Retirar do plano preserva o registro e permite desfazer. Salvar a rotina não encerra rodízios futuros.
- **Registrar estudo:** trocar competência por busca de área, tema ou competência, com ou sem acentos. A seleção preserva os demais campos.
- **Conteúdos → Ajustar competência:** nome, importância, esforço e duração de revisão; histórico e memória são preservados.
- **Progresso:** indicadores com evidência, quatro semanas, histórico recente e erros específicos pesquisáveis. O caderno aceita registro independente da sessão, com repetição segura após falha.

## Limites explícitos

- A previsão semanal mostra capacidade, não uma promessa de tarefas ou de aprendizado futuro. O plano diário é recalculado a partir do estado real, sem simular sessões concluídas.
- Calendar é somente leitura, com consulta dos próximos 14 dias solicitada pelo usuário. Não há refresh token, sincronização com app fechado nem criação de eventos de estudo. O fluxo servidor/PKCE originalmente proposto foi substituído pelo Token Model do GIS para esta entrega estática. Veja `google-calendar.md`.
- Na ausência de token em memória, desconectar remove o snapshot do Studygram e oferece o link de revogação na Conta Google. Com token presente, tenta revogar diretamente.
- Erros específicos não são contados como questões adicionais. A influência é limitada e considera apenas os abertos nos últimos 30 dias. A repetição usa a descrição normalizada; não há classificação por IA.
- As taxas semanais descrevem amostras registradas; não provam melhora causal nem evolução da retenção. Retenção é estimada pelo FSRS, não garantia de domínio.
- Não há IA, pagamentos, offline, snapshots históricos do plano ou analytics de produto nesta entrega. Essas extensões permanecem nas fases seguintes.

## Validação

`npm run check`: TypeScript, testes de domínio/integração/UI, PostgreSQL local com RLS e três simulações. O banco real teve a migration aplicada e as permissões verificadas: função de eventos com `security invoker`, acesso autenticado e sem execução anônima. A prévia mobile foi exercitada em 320 e 390 pixels sem rolagem horizontal do conteúdo; a busca e os controles foram inspecionados no navegador.

O auditor do Supabase mantém dois avisos preexistentes: credenciais privadas sem policies (tabela não utilizada, intencionalmente sem acesso dos clientes) e [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Não foram ampliadas permissões de acesso a dados de outras contas.
