# Studygram

Aplicação web de estudos adaptativos. Interface em português, responsiva e com modo claro/escuro do sistema.

**Stack:** React + Vite + TypeScript, Supabase Auth/PostgreSQL/RLS e Edge Function para sessões. Publicação estática no GitHub Pages; núcleo independente para futura interface mobile.

## Uso

1. Criar conta, confirmar e-mail e entrar.
2. Em **Plano**, salvar objetivo, contexto e janelas de disponibilidade.
3. Em **Conteúdos**, adicionar área, tema e competências, relacionando o contexto quando adequado.
4. Em **Hoje**, iniciar uma atividade, estudar no seu material e registrar o resultado. Conteúdo novo inclui recuperação sem consulta; para apenas leitura/aula, selecionar esse método.
5. Em **Progresso**, acompanhar retenção estimada, cobertura e questões.

## Desenvolvimento

Node.js 22+ e npm:

```sh
npm ci
npm run dev
npm run check
npm run build
```

O Vite serve `/studygram_/`. URL/chave publicável do Supabase estão no cliente e podem ser substituídas por `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Não são segredos; autorização é por Auth/RLS. Nunca colocar credenciais privilegiadas em variável VITE.

`npm run build:edge` gera a função para Supabase. `node scripts/smoke-public.mjs` verifica proteções no backend real. Consulte [publicação e configuração de e-mail](docs/deployment.md).

## Implementado

- Auth: login, cadastro, recuperação de senha e saída.
- Rotina/contexto e importação de temas em transação; busca e arquivamento.
- Plano diário explicável com ajuste rápido de tempo, limites e seleção por valor/tempo.
- Registro de estudo externo, sessões completas/parciais/não realizadas e questões.
- FSRS no servidor; leitura passiva não altera memória.
- Importação do Notion por CSV ou tabela colada, com prévia, mapeamento, duplicatas e histórico preservado. [Como importar](docs/notion-import.md).
- Ciclo de estudo com próximos passos concretos, começo de 5 minutos, timer com retomada e materiais externos. [Como funciona](docs/study-cycle.md).
- Plano com barras de tempo por dia e leitura de disponibilidade do Google Calendar. Requer ativação do Client ID OAuth: [configuração e limites](docs/google-calendar.md).
- Gravação atômica, idempotência e controle de versão entre dispositivos.
- Progresso: retenção estimada, questões, cobertura e competências em risco.
- Migrations: 21 tabelas públicas, uma privada, RLS, índices e constraints.
- Testes de domínio, PostgreSQL e interação; workflow de validação/publicação.

## Documentação e limites

[Arquitetura](docs/architecture.md) · [Simulação de 60 dias](simulation/output/report.md) · [Operação](docs/deployment.md)

A simulação usa 50 temas/150 competências fictícias em três seeds; nenhuma fixture é inserida em produção. Testes de UI simulam respostas de transporte; testes SQL executam PostgreSQL local. O primeiro login confirmado deve validar o fluxo completo em produção.

Próximos módulos: provas/rodízios futuros na interface, snapshots diários, calendário semanal, sincronização em segundo plano, IA e offline. O plano atual é calculado no navegador a partir dos dados reais; a memória é atualizada no servidor. Ajustes rápidos de tempo e formulários não salvos não sobrevivem a recarregamento. Não há pagamentos.

## Estrutura

```text
web/                  interface e adaptadores de dados/fuso
src/domain/           tipos e validação
src/engine/           memória, prioridade, disponibilidade, plano
src/application/      validação e cálculo de sessão
src/ports/            contratos futuros
server/               handler autenticado
scripts/              build da função e smoke test
simulation/           catálogo e resultados sintéticos
tests/                domínio, transações, RLS e UI
supabase/migrations/  schema versionado
.github/workflows/    validação e publicação
docs/                 arquitetura e operação
```
