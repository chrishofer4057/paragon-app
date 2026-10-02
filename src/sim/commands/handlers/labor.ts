import { GATHERING, REPUTATION, TAVERN } from '../../data/balance';
import { CHARACTERS } from '../../data/characters';
import { GOODS } from '../../data/goods';
import { SKILL_YIELD_PER_LEVEL } from '../../data/skills';
import { emit, type SimContext } from '../../context';
import type { OfferId } from '../../state/ids';
import { addReputation } from '../../systems/reputation';
import { gainSkillXp } from '../../systems/skills';
import { addGoods, freeCapacity } from '../../systems/storage';
import { fail, ok, type CommandResult, type GatherActivity } from '../commands';
import { firstError, requireCity, requireNotBusy, requirePermission } from '../guards';

/**
 * Handarbeit (Stufe 1, CLAUDE.md §2.3): Sammeln im Umland mit einer kleinen
 * Geschicklichkeitsentscheidung (Qualität 0..1 aus dem Phaser-Minispiel), Tagelöhnerarbeit
 * in der Taverne. Beides kostet Spielzeit – die Figur ist danach eine Weile beschäftigt.
 */

export function handleGather(ctx: SimContext, activity: GatherActivity, quality: number): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = firstError(requireNotBusy(state), requirePermission(state, 'gather'));
  if (error) return error;
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) return fail('Ungültige Qualität.');
  const def = GATHERING[activity];
  const p = state.player;
  const skill = p.skills[def.skill];
  const character = CHARACTERS[p.characterId];
  const qualityFactor = GATHERING.qualityMin + (GATHERING.qualityMax - GATHERING.qualityMin) * quality;
  const yieldAmount =
    def.baseYield *
    qualityFactor *
    (1 + skill.level * SKILL_YIELD_PER_LEVEL) *
    (character.gatherYield[def.good] ?? 1);
  const amount = Math.round(Math.min(yieldAmount, freeCapacity(state, { kind: 'inventory' })) * 1000) / 1000;
  if (amount <= 0) return fail('Euer Rucksack ist voll.');

  addGoods(p.inventory, def.good, amount);
  gainSkillXp(state, def.skill, GATHERING.xpPerAction * (0.5 + quality));
  p.busyUntilTick = state.tick + def.hours;
  emit(ctx, { type: 'GoodsGathered', cityId: where.cityId, good: def.good, amount });
  return ok(`Ihr habt ${amount.toFixed(2)} ${GOODS[def.good].name} gesammelt.`);
}

export function handleWorkDayJob(ctx: SimContext, jobId: OfferId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = firstError(requireNotBusy(state), requirePermission(state, 'dayJobs'));
  if (error) return error;
  const tavern = state.cities[where.cityId].tavern;
  const job = tavern.dayJobs.find((j) => j.id === jobId);
  if (!job) return fail('Diese Arbeit ist nicht mehr zu haben.');

  tavern.dayJobs = tavern.dayJobs.filter((j) => j.id !== jobId);
  state.player.money += job.wage;
  state.player.busyUntilTick = state.tick + TAVERN.dayJobHours;
  addReputation(state, where.cityId, {
    social: REPUTATION.dayJobSocial,
    societal: REPUTATION.dayJobSocietal,
  });
  return ok(`${job.title}: Ihr verdient ${job.wage} GS.`);
}
