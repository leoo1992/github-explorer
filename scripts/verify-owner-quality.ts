import { analyzeOwnerQuality } from '../src/lib/owner-quality';

delete process.env.GITHUB_TOKEN;

const result = await analyzeOwnerQuality('leoo1992');

if (!result.complete) {
  throw new Error('Owner scan did not complete.');
}
if (result.analyzedRepositories !== result.totalRepositories) {
  throw new Error(
    `Owner scan incomplete: ${result.analyzedRepositories}/${result.totalRepositories}`,
  );
}
if (result.totalRepositories < 70) {
  throw new Error(`Unexpected public repository count: ${result.totalRepositories}`);
}
if (!result.repositories || result.repositories.length !== result.totalRepositories) {
  throw new Error('Owner scan did not return per-repository scores.');
}

console.log(
  `Owner quality integration OK: ${result.analyzedRepositories}/${result.totalRepositories}, average ${result.average}%`,
);
