const targets: Record<string, Record<string, string>> = {
  'README.md': {
    'user guide': 'docs/USER_GUIDE.md', 'full user guide': 'docs/USER_GUIDE.md',
    'pipeline reference': 'docs/PIPELINE.md', tests: 'tests/README.md', publishing: 'docs/PUBLISHING.md',
    'contributor setup, source map and workflow': 'docs/DEVELOPMENT.md',
    'project status and unfinished work': 'docs/STATUS.md', 'coding standards': 'CODING_STANDARDS.md',
    'agent instructions': 'AGENTS.md', 'verification limits': 'docs/VERIFICATION.md',
    'verification results and limitations': 'docs/VERIFICATION.md'
  },
  'desktop/REWRITE.md': {
    'development guidance': 'docs/DEVELOPMENT.md', status: 'docs/STATUS.md', verification: 'docs/VERIFICATION.md',
    'current source map and request/ipc flow': 'docs/DEVELOPMENT.md#source-layout',
    'frozen legacy vault oracle': 'desktop/tests/windows/interop/README.md',
    'current verification limits': 'docs/VERIFICATION.md', 'unfinished work': 'docs/STATUS.md#unfinished-work',
    'historical gate checklist': 'docs/history/typescript-rewrite.md#parity-gates',
    'setup and checks': 'docs/DEVELOPMENT.md#setup-and-checks', 'suite/fixture reference': 'tests/README.md',
    publishing: 'docs/PUBLISHING.md', 'typescript rewrite history': 'docs/history/typescript-rewrite.md'
  }
};
for (const map of Object.values(targets)) Object.freeze(map);
Object.freeze(targets);
export const POLICY_CONFIG = Object.freeze({version: 3, targets, productFiles: 8, productBytes: 64_000,
  administrativeFiles: 8, administrativeBytes: 64_000,
  parser: 'closed-input-normalization-with-frozen-duplicate-scanner-v1', parserAutoMerge: true,
  parserScanner: '64409ab019d2551bbeab3ee9946ee96ab700e3b5e693b96f3efe51ff61356704',
  pipelineFixture: 'campaign-exact-option-text-and-factual-title-comment-v2',
  verification: 'read-only-components-v2',
  records: 'exact-coordinator-digests-and-validated-five-version-fields-v2',
  issueQualification: 'title-body-baseline-finding-task-bound-review-v2',
  finalization: 'selected-task-reused-issue-and-observed-windows-handoff-v3'});
