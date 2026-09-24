# RepoScope — GitHub Architecture Explorer

Aplicação web que analisa repositórios públicos do GitHub e apresenta arquitetura, stack, linguagens, dependências, árvore de arquivos e sinais de qualidade.

## O que demonstra

- integração real com a API do GitHub;
- análise heurística de arquitetura;
- descoberta de tecnologias por dependências e estrutura;
- inspeção de múltiplos `package.json`;
- visualização da composição de linguagens;
- mapa de camadas arquiteturais;
- sinais de qualidade como CI, testes, TypeScript, lint, Docker e licença;
- explorador de arquivos com busca;
- inventário de dependências;
- URL compartilhável via `?repo=owner/repository`;
- layout responsivo;
- cache server-side;
- tratamento de rate limit e erros da API.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- GitHub REST API
- Vercel

## Executar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

O token é opcional:

```env
GITHUB_TOKEN=
```

Sem token, a API pública do GitHub possui limite menor de requisições. O token nunca é enviado ao browser.

## Endpoints

```text
GET /api/health
GET /api/analyze?repo=leoo1992/pulsebi
```

## Arquitetura

Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Segurança

O projeto analisa somente repositórios públicos. Nenhum segredo ou token é retornado ao cliente.
