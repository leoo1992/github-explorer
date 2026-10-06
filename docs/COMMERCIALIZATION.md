# RepoScope — Estratégia de comercialização

## Posicionamento

O RepoScope deixa de ser apenas um explorador de arquitetura e passa a ser um produto de **engineering intelligence** para decisões de recrutamento, liderança técnica e avaliação de software.

A proposta de valor central é simples:

> transformar evidências públicas do GitHub em uma leitura técnica rápida, consistente e compartilhável.

## Segmentos prioritários

### 1. Recrutadores técnicos

Problema: abrir manualmente vários repositórios de cada candidato é lento e exige conhecimento técnico.

Valor do RepoScope:

- visão agregada do owner;
- score de sinais de qualidade por repositório;
- identificação rápida de stack e arquitetura;
- relatório compartilhável com o Tech Lead.

### 2. Empresas de recrutamento e seleção

Problema: cada recrutador avalia portfólios de forma diferente.

Valor do RepoScope:

- critério padronizado de triagem;
- comparação reproduzível entre portfólios;
- redução de tempo antes da entrevista técnica;
- possibilidade futura de workspace por cliente e vaga.

### 3. Tech Leads e Engineering Managers

Problema: entender um projeto novo exige navegar por arquivos, manifestos, CI e documentação.

Valor do RepoScope:

- mapa arquitetural;
- stack detectada por evidência;
- qualidade de CI, testes, lint, Docker e documentação;
- inventário de dependências e árvore de arquivos.

### 4. Empresas de tecnologia

Problema: due diligence técnica e revisão inicial de projetos consomem tempo de engenharia.

Valor do RepoScope:

- screening técnico rápido;
- critérios consistentes entre squads;
- relatórios auditáveis e compartilháveis;
- base futura para políticas internas de qualidade.

## Modelo de produto recomendado

### Free

Objetivo: aquisição e demonstração de valor.

- análise de repositório público;
- arquitetura, stack, linguagens e qualidade;
- link compartilhável;
- busca por nome de projeto.

### Recruiter Pro

Objetivo: monetização individual.

- análise completa de owner;
- histórico de candidatos;
- relatórios exportáveis;
- notas do recrutador;
- comparação entre candidatos;
- filtros por stack, qualidade e evidências.

### Team

Objetivo: empresas de recrutamento e times de tecnologia.

- workspace compartilhado;
- múltiplos usuários;
- vagas/processos seletivos;
- scorecards customizáveis;
- relatórios com identidade da empresa;
- limites maiores de análise;
- integração futura com ATS.

### Enterprise

Objetivo: empresas com políticas próprias e repositórios privados.

- GitHub App para repositórios privados;
- SSO;
- controles de acesso;
- critérios de qualidade customizados;
- API e webhooks;
- auditoria e retenção configurável.

## Roadmap para receita

### Fase 1 — MVP comercial

Já iniciado nesta versão:

- entrada separada para repositório, owner e nome de projeto;
- análise agregada de owner;
- experiência orientada a recrutamento e liderança técnica;
- melhoria de performance e remoção de chamadas duplicadas.

Próximos itens:

1. autenticação;
2. persistência de análises;
3. geração de relatório PDF/CSV;
4. comparação entre dois ou mais owners;
5. criação de scorecard por vaga;
6. limites por plano;
7. billing.

### Fase 2 — Recruiter Pro

- dashboard de candidatos;
- tags e notas;
- shortlist;
- relatório de candidato;
- compartilhamento privado;
- comparação lado a lado.

### Fase 3 — Team / Enterprise

- organizações;
- RBAC;
- GitHub App;
- repositórios privados;
- integrações com ATS;
- API comercial.

## Princípios de confiança

O RepoScope não deve afirmar que um score representa competência profissional. O score mede sinais observáveis de engenharia presentes em repositórios públicos.

Para uso em recrutamento:

- sempre mostrar as evidências por trás do score;
- permitir revisão humana;
- evitar inferências sobre atributos pessoais;
- não usar o score como decisão automática de contratação;
- explicar limitações de amostragem, projetos antigos e código não público.

## Métricas de negócio

Acompanhar:

- análises iniciadas por visitante;
- percentual que usa modo owner;
- tempo médio até resultado;
- taxa de compartilhamento de relatório;
- usuários que repetem análise em 7 e 30 dias;
- conversão Free → Pro;
- quantidade de candidatos analisados por recrutador;
- custo médio de API por análise.

## Moat potencial

O diferencial não deve ser apenas consultar a API do GitHub. O valor defensável deve vir de:

- scorecards configuráveis;
- histórico e comparação;
- explicabilidade das evidências;
- workflow de recrutamento;
- dados agregados do processo do cliente;
- integração com ATS e GitHub App;
- velocidade e experiência de uso.
