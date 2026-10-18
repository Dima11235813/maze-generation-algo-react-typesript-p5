/** The axe gate shared by the a11y and lesson specs: serious or critical violations fail. */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from './fixtures';

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

/**
 * Known violations in code owned by other workstreams, excluded until fixed (tracked in
 * proj-mgmt/12 "Lint and a11y debt"). Remove an entry as soon as the fix lands so the gate
 * tightens automatically.
 */
// Selectors excluded per page while a known violation is being fixed (each with its reason).
// Empty since WI-05 fixed the landing cards' contrast; keep it that way.
const KNOWN_ISSUES: Record<string, string[]> = {};

/** Fails on serious/critical violations; prints moderate/minor ones for the follow-up list. */
export async function expectNoSeriousViolations(page: Page, label: string): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
    'best-practice',
  ]);
  for (const selector of KNOWN_ISSUES[label] ?? []) builder = builder.exclude(selector);
  const results = await builder.analyze();
  const blocking = results.violations.filter(
    (v: Violation) => v.impact === 'serious' || v.impact === 'critical',
  );
  const advisory = results.violations.filter(
    (v: Violation) => v.impact !== 'serious' && v.impact !== 'critical',
  );
  if (advisory.length > 0) {
    console.info(
      `[axe] ${label}: ${advisory.length} advisory issue(s):\n` +
        advisory
          .map(
            (v: Violation) =>
              `  - ${v.id} (${v.impact ?? 'n/a'}): ${v.help} [${v.nodes.length} node(s)]`,
          )
          .join('\n'),
    );
  }
  expect(
    blocking.map((v: Violation) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(' ')),
    })),
    `${label}: serious/critical axe violations`,
  ).toEqual([]);
}
