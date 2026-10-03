import { test } from 'vitest';
import { runCareer } from './careerBot';

/** Balancing-Lauf (nicht Teil von `npm test`): `npm run balance`. */
test('Karriere über drei Spieljahre', () => {
  for (const characterId of ['gian', 'ursina'] as const) {
    const report = runCareer(
      Number(process.env['SEED'] ?? 7),
      characterId,
      Number(process.env['DAYS'] ?? 1080),
    );
    console.log(`\n=== ${characterId} ===`);
    console.log(report.timeline.join('\n'));
    console.log('Rang-Tage', JSON.stringify(report.rankDays));
    console.log('Geld', report.finalMoney, 'Vermögen', report.finalNetWorth, 'Betriebe', report.businesses);
    console.log('fehlgeschlagene Commands', JSON.stringify(report.failedCommands));
  }
}, 600_000);
