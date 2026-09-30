export interface OwnerRepositoryLite {
  name: string;
  full_name: string;
  default_branch: string;
  owner: { login: string };
  license: { spdx_id?: string | null; name?: string | null } | null;
}

type FastFile = { path: string; content: string };

async function fetchRawFile(repository: OwnerRepositoryLite, path: string): Promise<FastFile | null> {
  const ref = repository.default_branch.split('/').map(encodeURIComponent).join('/');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = 'https://raw.githubusercontent.com/' + encodeURIComponent(repository.owner.login) + '/' + encodeURIComponent(repository.name) + '/' + ref + '/' + encodedPath;
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Raw GitHub respondeu com HTTP ' + response.status + ' em ' + repository.full_name + '/' + path + '.');
  return { path, content: await response.text() };
}

async function fetchFirstRaw(repository: OwnerRepositoryLite, paths: string[]): Promise<FastFile | null> {
  for (const path of paths) {
    const file = await fetchRawFile(repository, path);
    if (file) return file;
  }
  return null;
}

function gitignoreAdequate(content: string | null) {
  if (!content) return false;
  const normalized = content.toLowerCase();
  const secrets = /(^|\n)\s*\.env(?:\.\*|\s*$)/m.test(normalized);
  const dependencies = /(^|\n)\s*(node_modules|\.venv|venv|__pycache__)\/?\s*$/m.test(normalized);
  const generated = /(^|\n)\s*(\.next|dist|build|out|coverage|target)\/?\s*$/m.test(normalized);
  return secrets && dependencies && generated;
}

function dockerSafe(content: string | null) {
  if (!content) return false;
  const fromLines = content.match(/^\s*FROM\s+([^\s]+)/gim) ?? [];
  const pinned = fromLines.length > 0 && fromLines.every((line) => {
    const image = line.replace(/^\s*FROM\s+/i, '').trim().split(/\s+/)[0];
    return image === 'scratch' || image.includes('@sha256:') || (image.includes(':') && !image.endsWith(':latest'));
  });
  const users = [...content.matchAll(/^\s*USER\s+([^\s#]+)/gim)];
  const finalUser = users.at(-1)?.[1].toLowerCase() ?? null;
  const nonRoot = finalUser !== null && finalUser !== 'root' && finalUser !== '0';
  const hardcodedSecret = /^\s*(?:ENV|ARG)\s+[^\n]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY)\s*=\s*[^$\s][^\s#]*/gim.test(content);
  return pinned && nonRoot && !hardcodedSecret;
}

function coverage80(text: string) {
  const patterns = [
    /--cov-fail-under(?:=|\s+)(\d{1,3})/gi,
    /fail_under\s*=\s*(\d{1,3})/gi,
    /minimum_coverage\s*=\s*(\d{1,3})/gi,
    /--test-coverage-lines(?:=|\s+)(\d{1,3})/gi,
    /(?:coverageThreshold|thresholds)[\s\S]{0,800}?lines\s*[:=]\s*(\d{1,3})/gi,
  ];
  return patterns.some((pattern) => {
    for (const match of text.matchAll(pattern)) {
      if (Number.parseInt(match[1], 10) >= 80) return true;
    }
    return false;
  });
}

function packageDependencies(text: string) {
  const result = new Set<string>();
  for (const candidate of text.split('\n---PACKAGE---\n')) {
    try {
      const parsed = JSON.parse(candidate) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      for (const name of Object.keys(parsed.dependencies ?? {})) result.add(name.toLowerCase());
      for (const name of Object.keys(parsed.devDependencies ?? {})) result.add(name.toLowerCase());
    } catch {
      // Invalid or absent package manifest.
    }
  }
  return result;
}

async function workflowPassed(repository: OwnerRepositoryLite, workflowPath: string | null) {
  if (!workflowPath) return false;
  const workflowFile = workflowPath.split('/').at(-1);
  if (!workflowFile) return false;
  const url = 'https://github.com/' + repository.full_name + '/actions/workflows/' + encodeURIComponent(workflowFile) + '/badge.svg?branch=' + encodeURIComponent(repository.default_branch);
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    if (!response.ok) return false;
    const svg = (await response.text()).toLowerCase();
    return /\b(passing|success)\b/.test(svg) && !/\b(failing|failure|error)\b/.test(svg);
  } catch {
    return false;
  }
}

export async function scoreRepositoryQuotaSafe(repository: OwnerRepositoryLite) {
  const [gitignore, readme, envExample, architecture, licenseFile, dockerfile, rootPackage, qualityPackage, lockfile, tsconfig, knip, eslintConfig, formatterConfig, testFile, workflow, sensitiveFiles] = await Promise.all([
    fetchFirstRaw(repository, ['.gitignore']),
    fetchFirstRaw(repository, ['README.md', 'README.MD', 'readme.md']),
    fetchFirstRaw(repository, ['.env.example', 'quality/.env.example']),
    fetchFirstRaw(repository, ['docs/ARCHITECTURE.md', 'ARCHITECTURE.md', 'ARQUITETURA.md']),
    fetchFirstRaw(repository, ['LICENSE', 'LICENSE.md', 'LICENCE']),
    fetchFirstRaw(repository, ['quality/Dockerfile', 'Dockerfile']),
    fetchFirstRaw(repository, ['package.json']),
    fetchFirstRaw(repository, ['quality/package.json']),
    fetchFirstRaw(repository, ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'go.sum', 'Cargo.lock']),
    fetchFirstRaw(repository, ['quality/tsconfig.json', 'tsconfig.json']),
    fetchFirstRaw(repository, ['quality/knip.json', 'knip.json', 'knip.config.ts', 'knip.config.js']),
    fetchFirstRaw(repository, ['quality/eslint.config.mjs', 'eslint.config.mjs', 'eslint.config.js', '.eslintrc.js', '.eslintrc.json']),
    fetchFirstRaw(repository, ['prettier.config.mjs', 'prettier.config.js', '.prettierrc', 'biome.json']),
    fetchFirstRaw(repository, ['tests/repository-quality.test.mjs', 'test/repository-quality.test.mjs', 'src/App.test.tsx', 'src/App.test.ts', 'src/App.test.jsx']),
    fetchFirstRaw(repository, ['.github/workflows/quality.yml', '.github/workflows/repository-quality.yml', '.github/workflows/ci.yml', '.github/workflows/ci.yaml']),
    Promise.all(['.env', 'credentials.json', 'service-account.json', 'secrets.json', 'id_rsa', 'id_ed25519'].map((path) => fetchRawFile(repository, path))),
  ]);

  const packageText = [rootPackage?.content, qualityPackage?.content].filter(Boolean).join('\n---PACKAGE---\n');
  const configText = [packageText, tsconfig?.content, knip?.content, eslintConfig?.content, formatterConfig?.content, workflow?.content].filter(Boolean).join('\n');
  const deps = packageDependencies(packageText);
  const workflowText = workflow?.content ?? '';
  const pipelinePassed = await workflowPassed(repository, workflow?.path ?? null);
  const hasLint = /\b(lint|eslint|ruff|flake8|pylint)\b/i.test(workflowText);
  const hasTests = Boolean(testFile) || ['jest', 'vitest', '@playwright/test', 'cypress'].some((dep) => deps.has(dep));
  const workflowHasTests = /\b(test|pytest|vitest|jest|playwright|cypress)\b/i.test(workflowText);
  const hasBuild = /\b(build|compile|package|wheel)\b/i.test(workflowText);
  const lintConfigured = Boolean(eslintConfig) || ['eslint', 'stylelint', 'biome', '@biomejs/biome'].some((dep) => deps.has(dep)) || /\b(eslint|ruff|flake8|pylint|golangci-lint|clippy)\b/i.test(configText);
  const typeChecking = Boolean(tsconfig) || deps.has('typescript') || /\b(tsc\s+(?:--noemit|-b)|mypy|pyright|flow\s+check)\b/i.test(configText);
  const formatter = Boolean(formatterConfig) || ['prettier', '@biomejs/biome', 'dprint', 'black', 'ruff'].some((dep) => deps.has(dep)) || /\b(prettier|biome\s+format|dprint|black|ruff\s+format|gofmt|rustfmt)\b/i.test(configText);
  const deadCode = Boolean(knip) || ['knip', 'ts-prune', 'unimported', 'vulture'].some((dep) => deps.has(dep)) || /"(?:noUnusedLocals|noUnusedParameters)"\s*:\s*true/i.test(tsconfig?.content ?? '');
  const sensitive = sensitiveFiles.some(Boolean);

  const signals = [
    !sensitive,
    gitignoreAdequate(gitignore?.content ?? null),
    Boolean(readme),
    Boolean(envExample),
    Boolean(architecture),
    Boolean(repository.license || licenseFile),
    dockerSafe(dockerfile?.content ?? null),
    Boolean(dockerfile),
    pipelinePassed,
    Boolean(workflow),
    Boolean(lockfile),
    hasTests,
    pipelinePassed && hasLint,
    lintConfigured,
    typeChecking,
    formatter,
    deadCode,
    coverage80(configText),
    pipelinePassed && workflowHasTests,
    pipelinePassed && hasBuild,
  ];
  const passed = signals.filter(Boolean).length;
  return Math.round((passed / signals.length) * 100);
}
