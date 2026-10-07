export interface RepositoryMeta {
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  sizeKb: number;
  license: string | null;
  updatedAt: string;
}

export interface LanguageStat {
  name: string;
  bytes: number;
  percentage: number;
}

export interface StackItem {
  name: string;
  category:
    | 'Frontend'
    | 'Backend'
    | 'Data'
    | 'Testing'
    | 'DevOps'
    | 'Tooling';
  evidence: string;
}

export interface ArchitectureLayer {
  name: string;
  role: string;
  technologies: string[];
}

export type QualitySignalStatus = 'pass' | 'fail' | 'unknown';

export interface QualityEvidence {
  kind: 'file' | 'workflow' | 'api' | 'rule';
  label: string;
  detail?: string;
  path?: string;
  url?: string;
  positive?: boolean;
}

export interface QualitySignal {
  criterionId?: string;
  label: string;
  found: boolean;
  detail: string;
  status?: QualitySignalStatus;
  evidence?: QualityEvidence[];
  remediation?: string;
}

export interface SecuritySummary {
  codeql: boolean;
  dependabot: boolean;
  actionsPermissionsExplicit: boolean;
  signedCommits: {
    verified: number;
    total: number;
  };
  dependencyAlerts: {
    available: boolean;
    open: number;
    advisories: string[];
  };
  secretIndicators: string[];
}

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size: number | null;
}

export interface DependencyItem {
  name: string;
  version: string;
  scope: 'runtime' | 'development';
  manifest: string;
}

export interface RepositoryAnalysis {
  repository: RepositoryMeta;
  languages: LanguageStat[];
  stack: StackItem[];
  layers: ArchitectureLayer[];
  qualitySignals: QualitySignal[];
  appliedCriteriaIds: string[];
  qualityProfile: string;
  security: SecuritySummary;
  dependencies: DependencyItem[];
  tree: TreeEntry[];
  totals: {
    files: number;
    directories: number;
    manifests: number;
  };
  treeTruncated: boolean;
  rateLimitRemaining: number | null;
  analyzedAt: string;
}
