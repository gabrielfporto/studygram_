# Operação — aplicação web

Projeto: Studygram (`aksjxellsgshapbntoby`). Repositório: `gabrielfporto/studygram_`.
Endereço esperado do Pages: `https://gabrielfporto.github.io/studygram_/`.

## Publicação

O workflow `.github/workflows/pages.yml` valida tipos, testes e simulação antes do build. Publica o diretório `dist` da branch main em GitHub Pages. Pull requests executam somente o build. O caminho base `/studygram_/` está configurado no Vite; a navegação interna usa estado, sem rotas que dependam de rewrite do servidor.

Se o Pages ainda não estiver habilitado, abrir Settings → Pages → Source → GitHub Actions no repositório. O workflow tenta habilitar automaticamente, mas a política da conta pode exigir essa ação manual.

No Supabase, configurar Authentication → URL Configuration:

- Site URL: `https://gabrielfporto.github.io/studygram_/`
- Redirect URLs: `https://gabrielfporto.github.io/studygram_/`
- Para desenvolvimento: `http://127.0.0.1:5174/studygram_/` e `http://localhost:5173/studygram_/`

Sem essas URLs, confirmação de cadastro e recuperação podem redirecionar ao endereço padrão do projeto. O envio de e-mail segue os limites/configuração SMTP do Supabase. Não desabilitar confirmação de e-mail para contornar limites. O primeiro usuário cria sua própria conta e confirma o e-mail.

## Banco e função

As migrations iniciais e `web_transactions` foram aplicadas pelo conector ao projeto informado. O histórico remoto usa timestamps de aplicação, portanto compare nomes/conteúdo antes de executar qualquer `db push`; não reaplique arquivos cegamente. Não há dados fictícios inseridos em produção.

`import_topic` e `configure_study` usam SECURITY INVOKER + RLS. `commit_study_session` é executável apenas por service_role: serializa por usuário, verifica revisão, preserva idempotência e grava sessão/questões/memória/evento na mesma transação.

A função `study-session` verifica o bearer token com `auth.getUser()` antes de acessar o serviço privilegiado. O `verify_jwt` do gateway está desligado porque a validação ocorre explicitamente na função e suporta chaves modernas. Nenhuma requisição de gravação é aceita sem autenticação válida. `npm run build:edge` gera o bundle para deploy; credenciais privilegiadas são lidas somente do ambiente Supabase. O bundle gerado não é commitado.

Os advisors podem informar ausência de policy em `private.calendar_credentials`: é intencional, pois o cliente não recebe acesso ao schema/tabela. Calendar ainda não foi conectado e nenhum token foi armazenado.

## Validação e limites

`npm run check`, `npm run build`, `npm run build:edge`. Testes de transação executam PostgreSQL local; testes de UI simulam apenas as respostas de transporte. `node scripts/smoke-public.mjs` verifica no projeto real a recusa sem sessão e o CORS do Pages. O primeiro login confirmado deve validar o percurso completo em produção: rotina → conteúdo → plano → sessão → atualização após recarregar.

Ainda não implementado: Google Calendar, IA, provas/rodízios futuros na interface, plano semanal visual, persistência dos snapshots diários e outbox offline. As tabelas/contratos existem para essas próximas etapas. Nesta versão o plano diário é derivado dos dados reais no navegador; a memória é calculada no servidor. O ajuste rápido de tempo vale na aba durante o dia e não é sincronizado entre dispositivos.

Fusos e janelas usam Temporal. Perfil/rotina e conteúdo são persistidos no Supabase. Uma falha de gravação mantém o formulário aberto e a mesma chave para nova tentativa; recarregar a página descarta o formulário não salvo.
