# RepoScope — GitHub App (migração sem PAT)

## Estado
A integração da branch `feat/github-app-only-auth` usa **somente installation access tokens**, obtidos a partir de JWT RS256 assinado no servidor. Não há fallback para `GITHUB_TOKEN`.

**Não faça merge nem remova o PAT de produção antes de configurar e testar a GitHub App.**

## Registrar a App
1. Acesse https://github.com/settings/apps/new e crie uma GitHub App chamada, por exemplo, `reposcope-quality` (o nome precisa estar disponível).
2. Homepage: `https://github-explorer-tawny-chi.vercel.app`.
3. Webhook URL: `https://github-explorer-tawny-chi.vercel.app/api/github/webhook`; habilite SSL verification.
4. Permissões de repositórios **Read-only**: Metadata, Contents, Actions, Checks, Commit statuses, Dependabot alerts, Security events (Code scanning), Secret scanning (quando disponíveis no plano da instalação). Adicione apenas as realmente necessárias.
5. Eventos: `push`, `installation`, `installation_repositories`.
6. Instalação: `Any account` para um SaaS, e escolha os repositórios permitidos.
7. Gere uma private key (arquivo PEM) e copie **o conteúdo** para segredo da Vercel; nunca adicione a chave ao Git.
8. Configure as variáveis de produção `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM, com quebras de linha originais ou \n), `GITHUB_APP_WEBHOOK_SECRET`.
9. Faça deploy de Preview desta branch com variáveis de Preview e teste consulta de repositório instalado, score, limites e webhooks.
10. Só após validação, faça merge na main e remova `GITHUB_TOKEN` da Vercel.

## Segurança
Installation token expira e é regenerado automaticamente. A chave privada fica exclusivamente no servidor.
A API de análise atual é voltada a repositórios **públicos**; esta migração não habilita automaticamente análise de repositórios privados. Para privados, implemente autorização da instalação vinculada ao usuário/organização antes de liberar.
Requisições de webhook são verificadas por assinatura HMAC SHA-256. A associação por SHA do cache preserva históricos enquanto novos commits criam entradas novas.
GitHub App não dispensa fila, backoff e controles de rate limit.

## Critério de aceite
- Sem uso de `GITHUB_TOKEN` no runtime após o corte.
- Instalação autorizada fornece token temporário e análise de repositório público funciona.
- Repositório sem instalação retorna erro orientando a instalar.
- Chave inválida retorna erro, nunca fallback para PAT.
- Webhook sem assinatura é rejeitado.
- Múltiplas instalações não compartilham tokens.
- Build, lint e typecheck aprovados no Preview.
- Rollback documentado: reverter o deploy da main à versão anterior, sem reintroduzir o PAT por código.
