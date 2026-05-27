/* @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialCombatStatuses } from '../sim/combatStatus';
import { PlayerStatusPanel } from './PlayerStatusPanel';

describe('PlayerStatusPanel', () => {
  it('renders fixed HP and empty buff windows for the party', () => {
    const html = renderToStaticMarkup(
      <PlayerStatusPanel statuses={createInitialCombatStatuses()} />,
    );

    expect(html).toContain('Player Status');
    expect(html).toContain('MT');
    expect(html).toContain('HP 10,000 / 10,000');
    expect(html).toContain('Buffs: None');
  });

  it('renders active buffs when present', () => {
    const html = renderToStaticMarkup(
      <PlayerStatusPanel
        statuses={[
          {
            buffs: [{ id: 'damage-up', name: 'Damage Up', stacks: 2 }],
            currentHp: 7123,
            maxHp: 10000,
            role: 'MT',
          },
        ]}
      />,
    );

    expect(html).toContain('HP 7,123 / 10,000');
    expect(html).toContain('Damage Up x2');
  });
});
