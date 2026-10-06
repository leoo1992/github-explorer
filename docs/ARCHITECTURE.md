# Arquitetura

```text
Browser
  │
  ├─ Landing pública
  ├─ Login / cadastro
  │    └─ Supabase Auth
  │         ├─ e-mail/senha
  │         ├─ Google OAuth
  │         └─ Microsoft/Azure OAuth
  │
  ├─ Pricing / Checkout
  │    └─ Stripe Checkout + Billing
  │         └─ Webhook assinado
  │              └─ Supabase public.subscriptions
  │
  └─ Dashboard protegido
       ├─ GET /api/analyze
       └─ GET /api/owner-quality
              │
              ├─ valida usuário Supabase
              ├─ valida assinatura ativa/trialing
              ├─ GitHub APIs
              └─ Analyzer Engine
                   ├─ stack detection
                   ├─ architecture layers
                   ├─ quality signals
                   └─ dependency inventory
```

## Decisões

- **Next.js App Router / Route Handlers** mantém integrações e segredos no servidor.
- **Supabase Auth** gerencia identidade e sessões SSR em cookies usando `@supabase/ssr`.
- **RLS** protege a tabela `subscriptions`; o usuário autenticado lê somente a própria assinatura.
- **Supabase secret key** é usada apenas no backend para sincronizações administrativas originadas do Stripe.
- **Stripe Checkout + Billing** gerencia a assinatura recorrente.
- **Webhook Stripe** valida assinatura criptográfica antes de alterar estado de billing.
- **Autorização server-side** exige usuário válido e assinatura `active` ou `trialing` antes de executar uma análise.
- **GITHUB_TOKEN** permanece server-side.
- **Análise heurística** mostra evidências detectadas e não afirma competência profissional nem toma decisões automáticas de contratação.

## Variáveis principais

```text
GITHUB_TOKEN
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
NEXT_PUBLIC_PLAN_PRICE_LABEL
```

Nenhuma chave secreta deve ser exposta com prefixo `NEXT_PUBLIC_`.

## Fluxo de autorização

1. usuário autentica no Supabase;
2. inicia Checkout no Stripe;
3. Stripe confirma a assinatura e dispara eventos;
4. webhook sincroniza `public.subscriptions`;
5. dashboard e APIs consultam o estado da assinatura;
6. somente usuários autenticados com assinatura liberada executam análises.

## Limites intencionais do analisador

- apenas repositórios públicos nesta fase;
- árvore visual resumida em repositórios muito grandes;
- detecção prioriza stacks e sinais comuns de engenharia;
- scores representam somente evidências observáveis no código/repositório.
