# Arquitetura

```text
Browser
  │
  ├─ Landing pública / Login / Pricing
  │      │
  │      └─ Supabase Auth
  │             ├─ Email + senha (fallback permanente)
  │             ├─ Google OAuth (somente quando disponível)
  │             └─ Microsoft/Azure OAuth (somente quando disponível)
  │
  ├─ Stripe Checkout ──> /api/billing/checkout
  │                         │
  │                         └─ Stripe Billing
  │                              │
  │                              └─ /api/billing/webhook
  │                                      │
  │                                      └─ public.subscriptions (Supabase)
  │
  ├─ /account ──> Stripe Customer Portal
  │
  └─ Dashboard pago
         │
         └─ GET /api/analyze
                │
                ├─ valida sessão Supabase
                ├─ valida assinatura active/trialing ou acesso administrativo
                └─ GitHub REST API
                       │
                       └─ Analyzer Engine
                            ├─ stack detection
                            ├─ architecture layers
                            ├─ critérios configuráveis
                            ├─ quality signals
                            ├─ fila de reprocessamento
                            └─ dependency inventory
```

## Autenticação

- Next.js usa `@supabase/ssr` com sessão em cookies.
- O proxy renova/valida claims antes de páginas protegidas.
- E-mail e senha são o método base e o fallback permanente.
- Google e Microsoft/Azure são opcionais e nunca são anunciados de forma estática.
- `src/lib/auth-providers.ts` consulta `/auth/v1/settings` do Supabase com `cache: no-store` e timeout curto.
- Landing, login e `/api/auth/providers` consomem a mesma função de disponibilidade.
- Se a configuração não existir, a consulta falhar ou o provedor tiver falha de callback, ele é tratado como indisponível.
- Uma falha OAuth conhecida gera cookie temporário de indisponibilidade por 10 minutos para manter a UI consistente entre páginas.
- A callback da aplicação é `/auth/callback`.
- A callback a cadastrar nos provedores sociais é `https://boamqtcyvflgpewomfhj.supabase.co/auth/v1/callback`.

## Regra de fallback de autenticação

A apresentação dos métodos é **fail-closed**:

1. a UI assume Google e Microsoft como indisponíveis até confirmação positiva;
2. apenas provedores reportados como habilitados pelo Supabase podem aparecer;
3. se uma tentativa OAuth falhar, o provedor é ocultado e e-mail/senha permanece disponível;
4. textos comerciais e operacionais usam a mesma disponibilidade real, evitando prometer um método que não está funcional.

## Autorização paga

- `public.subscriptions` referencia `auth.users(id)`.
- RLS está habilitado.
- Usuários autenticados possuem somente `SELECT` da própria assinatura.
- Escritas de billing são server-side.
- Status `active` e `trialing` liberam as APIs de análise.
- Contas administrativas internas também podem ser liberadas sem cobrança por metadado de aplicação controlado no servidor.
- Sem autenticação, APIs retornam `401`; sem assinatura ativa ou acesso administrativo, retornam `402`.

## Billing

- Stripe Checkout opera em `mode: subscription`.
- O plano comercial é RepoScope Pro por **R$ 9,90/mês**.
- Webhooks verificam `stripe-signature` antes de processar eventos.
- O estado é sincronizado em checkout concluído, pagamento assíncrono concluído, mudanças de assinatura, invoice paga e falha de invoice.
- Customer Portal permite atualizar dados/método de pagamento, consultar faturas e cancelar ao fim do período.

## Análise técnica

- O `GITHUB_TOKEN` fica somente no servidor.
- O produto analisa repositórios públicos.
- O usuário escolhe quais critérios entram no cálculo; critérios desmarcados não entram no denominador e não são tratados como falha.
- Há presets de cenário e seleção individual dos sinais.
- O score é heurístico e sempre deve ser apresentado com suas evidências.
- Scores de repositórios não representam competência profissional nem podem ser usados como decisão automática de contratação.

## Processamento resiliente

A análise opera sobre um repositório público por vez.

- entradas aceitas: `owner/repository` ou URL completa do GitHub;
- owner isolado e nome de projeto não são aceitos;
- etapas temporariamente indisponíveis retornam estado `waiting` e são retomadas automaticamente pela interface;
- evidência dinâmica de CI indisponível nunca é convertida automaticamente em sucesso ou reprovação.

As APIs não devolvem detalhes técnicos de falhas externas para a interface. Estados operacionais previsíveis (`waiting`, `not_found` e `input`) orientam a UI.

## Segurança

- chaves secretas do Supabase e Stripe nunca usam prefixo `NEXT_PUBLIC_`;
- Stripe webhook signing secret é server-side;
- tabela de assinatura usa RLS e menor privilégio;
- autorização administrativa usa `app_metadata`, não `user_metadata`;
- nenhuma chave secreta é persistida no repositório;
- provedores OAuth seguem comportamento fail-closed;
- CI executa typecheck, lint, testes com cobertura mínima de 80% e build.
