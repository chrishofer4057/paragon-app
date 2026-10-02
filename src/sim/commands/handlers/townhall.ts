import { CONTRACTS, POPULATION } from '../../data/balance';
import { GOODS, type GoodId } from '../../data/goods';
import { newId, type SimContext } from '../../context';
import type { MissionKind, MotionKind } from '../../state/gameState';
import type { ContractId, MotionId } from '../../state/ids';
import { daysToTicks } from '../../time';
import { completeContractIfDone } from '../../systems/contracts';
import { totalPopulation } from '../../systems/demand';
import { checkLandRouteComplete, MISSIONS, motionSessionTick, smallestCity } from '../../systems/politics';
import { hasLocalPermission, isMayorOf } from '../../systems/ranks';
import { effectiveReputation } from '../../systems/reputation';
import { amountOf, removeGoods, resolveStorage, type StorageRef } from '../../systems/storage';
import { fail, ok, type CommandResult } from '../commands';
import {
  cityName,
  firstError,
  requireCity,
  requireGoodsAt,
  requireMoney,
  requirePermission,
  requirePositiveAmount,
} from '../guards';

export function handleAcceptContract(ctx: SimContext, contractId: ContractId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const city = state.cities[where.cityId];
  const error = requirePermission(state, 'cityContracts');
  if (error) return error;
  const contract = city.contracts.find((c) => c.id === contractId);
  if (!contract) return fail('Dieser Aushang ist nicht mehr da.');
  if (contract.acceptedByPlayer) return fail('Diesen Auftrag habt Ihr schon angenommen.');
  if (city.contractLockoutUntilTick > state.tick)
    return fail('Nach dem letzten verpassten Auftrag traut man Euch hier noch nicht.');
  if (effectiveReputation(state, where.cityId).societal < CONTRACTS.minSocietal) {
    return fail('Man kennt Euch hier noch zu wenig, um Euch Aufträge anzuvertrauen.');
  }
  contract.acceptedByPlayer = true;
  return ok(
    `Auftrag angenommen: ${contract.amount} ${GOODS[contract.good].name} zu je ${contract.pricePerUnit} GS.`,
  );
}

export function handleDeliverContract(
  ctx: SimContext,
  contractId: ContractId,
  amount: number,
  from: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const city = state.cities[where.cityId];
  const contract = city.contracts.find((c) => c.id === contractId);
  if (!contract?.acceptedByPlayer) return fail('Diesen Auftrag habt Ihr nicht angenommen.');
  const remaining = contract.amount - contract.delivered;
  if (amount > remaining + 1e-6) return fail(`Es fehlen nur noch ${Math.ceil(remaining)} Einheiten.`);
  const error = firstError(
    requirePositiveAmount(amount),
    requireGoodsAt(state, from, where.cityId, contract.good, amount),
  );
  if (error) return error;
  removeGoods(resolveStorage(state, from)!, contract.good, amount);
  // Der Auftragshändler gibt die Ware an die Markthalle weiter (2.1.1.3.1).
  city.market[contract.good] += amount;
  contract.delivered += amount;
  completeContractIfDone(ctx, where.cityId, contract);
  return ok(`${amount} ${GOODS[contract.good].name} geliefert.`);
}

export function handleProposeMotion(ctx: SimContext, motion: MotionKind): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  if (!hasLocalPermission(state, cityId, 'councilMotions'))
    return fail('Anträge stellen nur Ratsherren dieser Stadt.');
  const city = state.cities[cityId];
  if (city.motions.some((m) => m.motion.kind === motion.kind))
    return fail('Ein solcher Antrag steht bereits zur Abstimmung.');
  if (motion.kind === 'headTax') {
    if (!Number.isFinite(motion.rate) || motion.rate < 0 || motion.rate > POPULATION.maxHeadTax) {
      return fail(`Die Kopfsteuer liegt zwischen 0 und ${POPULATION.maxHeadTax * 100} %.`);
    }
  } else if (!Number.isFinite(motion.amount) || motion.amount <= 0) {
    return fail('Die Sondersteuer muss positiv sein.');
  }
  city.motions.push({
    id: newId<MotionId>(state, 'v'),
    motion: { ...motion },
    proposedTick: state.tick,
    sessionTick: motionSessionTick(state),
  });
  return ok(`Der Rat von ${cityName(cityId)} berät in 14 Tagen über Euren Antrag.`);
}

export function handleSetHeadTax(ctx: SimContext, rate: number): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  if (!isMayorOf(state, where.cityId)) return fail('Nur der Schultheiss legt die Kopfsteuer fest.');
  if (!Number.isFinite(rate) || rate < 0 || rate > POPULATION.maxHeadTax)
    return fail('Ungültiger Steuersatz.');
  state.cities[where.cityId].headTax = rate;
  return ok(`Kopfsteuer: ${Math.round(rate * 100)} %.`);
}

/** Schultheiss: Geld in die Stadtkasse einzahlen (positiv) oder entnehmen (negativ). */
export function handleTreasuryTransfer(ctx: SimContext, amount: number): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  if (!isMayorOf(state, where.cityId)) return fail('Nur der Schultheiss verfügt über die Stadtkasse.');
  if (!Number.isFinite(amount) || amount === 0) return fail('Ungültiger Betrag.');
  const city = state.cities[where.cityId];
  if (amount > 0) {
    const error = requireMoney(state, amount);
    if (error) return error;
  } else if (-amount > city.treasury) {
    return fail('So viel ist nicht in der Stadtkasse.');
  }
  state.player.money -= amount;
  city.treasury += amount;
  return ok();
}

export function handleAcceptMission(ctx: SimContext, mission: MissionKind): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const p = state.player;
  if (!p.liaInvited) return fail('Ihr habt keine Einladung in die Lia-Kanzlei.');
  if (where.cityId !== state.lia.capital)
    return fail(`Aufträge der Lia gibt es nur in ${cityName(state.lia.capital)}.`);
  if (!isMayorOf(state, p.homeCityId)) return fail('Nur amtierende Schultheisse erhalten Aufträge der Lia.');
  if (p.mission) return fail('Ihr habt bereits einen Auftrag der Lia.');
  if (p.missionLockoutUntilTick > state.tick)
    return fail('Nach dem gescheiterten Auftrag müsst Ihr einige Wochen warten.');
  if (mission === 'cityGlory') {
    const cityId = smallestCity(state);
    p.mission = {
      kind: 'cityGlory',
      cityId,
      startTick: state.tick,
      deadlineTick: state.tick + daysToTicks(MISSIONS.cityGlory.days),
      targetPopulation: Math.round(totalPopulation(state.cities[cityId]) + MISSIONS.cityGlory.growth),
      delivered: {},
    };
    return ok(
      `Verhelft ${cityName(cityId)} binnen eines Jahres zu ${MISSIONS.cityGlory.growth} neuen Einwohnern.`,
    );
  }
  p.mission = {
    kind: 'landRoute',
    cityId: state.lia.capital,
    startTick: state.tick,
    deadlineTick: state.tick + daysToTicks(MISSIONS.landRoute.days),
    targetPopulation: 0,
    delivered: {},
  };
  return ok(`Liefert das Baumaterial für den Landweg nach ${cityName(state.lia.capital)}.`);
}

export function handleDeliverMissionGoods(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  from: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const mission = state.player.mission;
  if (mission?.kind !== 'landRoute') return fail('Ihr habt keinen Landwegs-Auftrag.');
  if (where.cityId !== mission.cityId) return fail(`Geliefert wird nach ${cityName(mission.cityId)}.`);
  const needed = (MISSIONS.landRoute.materials as Partial<Record<GoodId, number>>)[good];
  if (needed === undefined) return fail(`${GOODS[good].name} wird für den Landweg nicht gebraucht.`);
  const remaining = needed - amountOf(mission.delivered, good);
  if (remaining <= 0) return fail(`Es ist bereits genug ${GOODS[good].name} da.`);
  const take = Math.min(amount, remaining);
  const error = firstError(
    requirePositiveAmount(amount),
    requireGoodsAt(state, from, where.cityId, good, take),
  );
  if (error) return error;
  removeGoods(resolveStorage(state, from)!, good, take);
  mission.delivered[good] = amountOf(mission.delivered, good) + take;
  checkLandRouteComplete(ctx);
  return ok(`${take} ${GOODS[good].name} für den Landweg geliefert.`);
}
