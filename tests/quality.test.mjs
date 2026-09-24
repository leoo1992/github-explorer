import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('documentação e arquivos de qualidade existem', () => {
  for (const path of ['README.md', 'LICENSE', '.env.example']) {
    assert.equal(existsSync(path), true, path + ' deve existir');
  }
});

test('CI/CD e containerização estão documentados no repositório', () => {
  assert.equal(existsSync('.github/workflows/quality.yml'), true);
  assert.equal(
    existsSync('Dockerfile') || existsSync('apps/web/Dockerfile'),
    true,
  );
});

test('README possui conteúdo', () => {
  assert.ok(readFileSync('README.md', 'utf8').trim().length > 20);
});
