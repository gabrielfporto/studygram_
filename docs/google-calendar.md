# Ativar Google Calendar no Studygram

A integração é por usuário: cada pessoa autoriza sua própria conta Google e escolhe até dez agendas. O Studygram lista agendas e consulta somente intervalos ocupados (`freeBusy`), sem importar títulos, descrições ou participantes dos eventos e sem escrever na agenda.

## Configuração inicial no Google Cloud

1. Entre em [Google Cloud Console](https://console.cloud.google.com/) e crie ou selecione um projeto para os testes do Studygram.
2. Em **APIs e serviços → Biblioteca**, ative a **Google Calendar API**.
3. Abra **Google Auth Platform** (ou a configuração da tela de consentimento OAuth). Cadastre o nome **Studygram**, e-mail de suporte e contato do desenvolvedor.
4. Em **Público-alvo / Audience**, selecione **Externo / External** e mantenha **Testing / Teste**. Cadastre seu e-mail Google em **Test users / Usuários de teste**. Outros testadores devem ser adicionados individualmente.
5. Em **Data Access / Acesso a dados**, selecione somente estes escopos:
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.events.freebusy`
6. Em **Clients / Clientes**, crie um cliente OAuth do tipo **Web application / Aplicativo da Web**.
7. Em **Authorized JavaScript origins / Origens JavaScript autorizadas**, informe exatamente `https://gabrielfporto.github.io` — sem `/studygram_`, sem caminho. Para desenvolvimento, adicione o host/porta local separadamente ao cliente de testes.
8. Este fluxo usa o pop-up do Google Identity Services. Não é necessário cadastrar URI de redirecionamento nem usar Client Secret.
9. Copie apenas o **Client ID**, que termina em `.apps.googleusercontent.com`.

O Client ID é público e identifica o aplicativo; cada usuário ainda precisa conceder seu próprio acesso. Nunca envie senha, código temporário ou Client Secret.

## Publicação da configuração

No repositório `gabrielfporto/studygram_`, em **Settings → Secrets and variables → Actions → Variables**, crie a variável de repositório **GOOGLE_CLIENT_ID** com o ID público. Execute novamente o workflow **Validate and publish Studygram**, ou publique um novo commit. O workflow passa o valor como `VITE_GOOGLE_CLIENT_ID` ao build do Vite. Para desenvolvimento local, use a mesma variável `VITE_GOOGLE_CLIENT_ID` no `.env` ignorado pelo Git.

O painel do app mostra a conexão como pendente enquanto o Client ID não estiver configurado. Não há dados fictícios nem autorização simulada no aplicativo publicado.

## Uso no aplicativo

1. Entre no Studygram e abra **Plano → Google Calendar**.
2. Clique em **Conectar Google Calendar** e autorize os dois acessos solicitados pelo Google.
3. Escolha as agendas e clique em **Sincronizar agendas selecionadas**.
4. Os intervalos ocupados dos próximos 14 dias são salvos em lote e descontados das janelas de estudo, inclusive do começo de cinco minutos. As horas livres continuam limitadas pela disponibilidade que o usuário definiu.
5. Use **Autorizar Google e atualizar** ou **Sincronizar agendas selecionadas** quando seus compromissos mudarem. A seleção anteriormente salva é reaproveitada ao reconectar à mesma conta.

## Limites desta versão e separação por usuário

É uma sincronização de leitura, solicitada pelo usuário, com token temporário apenas na memória da aba. Ao fechar a aba ou expirar a autorização, será necessário autorizar novamente para novas consultas. Não há sincronização com o app fechado, refresh token, criação de eventos de estudo nem atualização automática em segundo plano.

Os últimos intervalos conhecidos continuam sendo considerados. Depois de uma hora, ou quando a consulta não cobre o dia atual no fuso configurado, o app sinaliza que a agenda precisa ser atualizada. Uma falha total ou de qualquer agenda selecionada não apaga o último estado nem é interpretada como agenda vazia. Sobreposições são unidas pelo motor, sem descontar o mesmo período duas vezes.

**Desconectar agenda** remove os intervalos salvos e desativa as conexões do usuário. O app tenta revogar o acesso do Google se ainda tiver um token na aba; caso contrário, fornece o link para [gerenciar permissões na Conta Google](https://myaccount.google.com/permissions).

As tabelas usam RLS por `auth.uid()`. As funções de snapshot e desconexão usam `security invoker`, validam o lote e o salvam atomicamente. Nenhum token passa pelo Supabase. Os nomes e IDs das agendas selecionadas e os períodos ocupados ficam na conta correspondente do Studygram, visíveis somente ao próprio usuário.

Para liberar a pessoas fora da lista de teste, prepare a configuração de produção, os dados de marca/política de privacidade e a verificação exigida pelo Google para os escopos utilizados. Ambientes de teste e produção devem seguir a separação indicada pelo Google. A implementação não está restrita ao dono do projeto, mas a liberação efetiva depende do estado OAuth no Google Cloud.

## Verificação

Testes cobrem slider e persistência, OAuth/transporte com respostas simuladas, isolamento do token por conta, múltiplas agendas, erros parciais, fusos, união de intervalos, conflito no planejamento, cache desatualizado, RLS, rollback e desconexão isolada. O primeiro consentimento e a sincronização com uma conta real só podem ser conferidos depois que o Client ID estiver configurado.

Referências oficiais: [Token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Configurar OAuth](https://developers.google.com/workspace/guides/configure-oauth-consent), [FreeBusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query), [CalendarList](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list), [Preparação para produção](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).
