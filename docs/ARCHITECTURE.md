# Arquitetura

```text
Browser
  │
  ├─ Landing pública / Login / Pricing
  │      │
  │      └─ Supabase Auth
  │             ├─ Email + senha
  │             ├─ Google OAuth
  │             └─ Microsoft/Azure OAuth
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
         ├─ GET /api/analyze
         └─ GET /api/owner-quality
                │
                ├─ valida sessão Supabase
                ├─ valida assinatura active/trialing
                └─ GitHub REST API
                       │
                       └─ Analyzer Engine
                            ├─ stack detection
                            ├─ architecture layers
                            ├─ quality signals
                            └─ dependency inventory
```

## Autenticação

- Next.js usa `@supabase/ssr` com sessão em cookies.
- O proxy renova/valida claims antes de páginas protegidas.
- Cadastro/login suporta e-mail e senha; Google e Microsoft usam OAuth do Supabase.
- A callback da aplicação é `/auth/callback`.
- A callback a cadastrar nos provedores sociais é `https://boamqtcyvflgpewomfhj.supabase.co/auth/v1/callback`.

## Autorização paga

- `public.subscriptions` referencia `auth.users(id)`.
- RLS está habilitado.
- Usuários autenticados possuem somente `SELECT` da própria assinatura.
- Escritas de billing são server-side.
- Status `active` e `trialing` liberam as APIs de análise.
- Sem autenticação, APIs retornam `401`; sem assinatura ativa, retornam `402`.

## Billing

- Stripe Checkout opera em `mode: subscription`.
- O plano comercial é RepoScope Pro por **R$ 9,90/mês**.
- Webhooks verificam `stripe-signature` antes de processar eventos.
- O estado é sincronizado em checkout concluído, pagamento assíncrono concluído, mudanças de assinatura, invoice paga e falha de invoice.
- Customer Portal permite atualizar dados/método de pagamento, consultar faturas e cancelar ao fim do período.

## Análise técnica

- O `GITHUB_TOKEN` fica somente no servidor.
- O produto analisa repositórios públicos.
- O score é heurístico e sempre deve ser apresentado com suas evidências.
- Scores de repositórios não representam competência profissional nem podem ser usados como decisão automática de contratação.

## Segurança

- chaves secretas do Supabase e Stripe nunca usam prefixo `NEXT_PUBLIC_`;
- Stripe webhook signing secret é server-side;
- tabela de assinatura usa RLS e menor privilégio;
- nenhuma chave secreta é persistida no repositório;
- CI executa typecheck, lint, testes com cobertura mínima de 80% e build.
