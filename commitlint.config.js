// Conventional Commits (https://www.conventionalcommits.org) enforced by the commit-msg hook.
// Trailers such as `Co-Authored-By:` and `Claude-Session:` live in the footer and are allowed.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [2, 'always', 120],
    'footer-max-line-length': [2, 'always', 200],
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'],
    ],
  },
  // Merge commits produced by `git merge --no-ff` use a plain "merge: ..." header.
  ignores: [(message) => /^merge[:\s]/i.test(message)],
};
