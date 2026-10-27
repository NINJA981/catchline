import { describe, expect, it } from 'vitest';
import { SAMPLES, loadSample } from '../src/app/samples';
import { createWorkspace } from '../src/app/workspace';
import { scanInput } from '../src/engine/scan';

// Accessibility rules the reader view must keep (found by axe in the e2e sweep).
describe('reader view accessibility', () => {
  it.each(SAMPLES.map((s) => s.id))(
    '%s: marker names contain their visible mark (WCAG 2.5.3)',
    async (id) => {
      const ws = createWorkspace({
        scan: scanInput(await loadSample(id)),
        sourceLabel: id,
        onSelect: () => undefined,
      });
      const markers = ws.el.querySelectorAll<HTMLButtonElement>('button.marker');
      expect(markers.length).toBeGreaterThan(0);
      for (const m of markers) {
        const visible = m.textContent.trim();
        expect(visible.length).toBeGreaterThan(0);
        expect(m.getAttribute('aria-label') ?? '').toContain(visible);
      }
      ws.destroy();
    },
  );

  it('heading levels nest under the result heading and never skip a level', () => {
    const html =
      '<h1>Big deal</h1><h4>Skipped ahead*</h4><h2>Then back</h2><h6>Deep</h6><p>*Terms apply. $5 fee.</p>';
    const ws = createWorkspace({
      scan: scanInput(html),
      sourceLabel: 'pasted',
      onSelect: () => undefined,
    });
    const levels = Array.from(ws.el.querySelectorAll('[role="heading"]')).map((e) =>
      Number(e.getAttribute('aria-level')),
    );
    expect(levels.length).toBeGreaterThanOrEqual(3);
    let prev = 2;
    for (const l of levels) {
      expect(l).toBeLessThanOrEqual(prev + 1);
      expect(l).toBeGreaterThanOrEqual(2);
      prev = l;
    }
    ws.destroy();
  });
});
