import type { SimContext } from '../context';
import type { Command, CommandResult } from './commands';
import {
  handleBuildBusiness,
  handleBuildHouse,
  handleDemolishBusiness,
  handleFundInfrastructure,
  handleSetRentLevel,
  handleSetUtilization,
} from './handlers/building';
import {
  handleAnnounceFestival,
  handleBribe,
  handleDonate,
  handleGiveAlms,
  handleJoinGuild,
  handlePray,
  handleTakeBath,
} from './handlers/civic';
import {
  handleBuildWarehouse,
  handleFireManager,
  handleFoundKontor,
  handleHireManager,
  handleSetGuards,
  handleSetStandingOrder,
} from './handlers/kontor';
import { handleGather, handleWorkDayJob } from './handlers/labor';
import { handleGrantLoan, handleRepayLoan, handleResolveDefault, handleTakeLoan } from './handlers/lender';
import {
  handleOrderShip,
  handleRenameShip,
  handleRepairShip,
  handleSendShip,
  handleShipCargo,
  handleTravel,
} from './handlers/shipping';
import {
  handleAcceptQuest,
  handleBuyInformation,
  handleDeliverQuestGoods,
  handleDismissSailors,
  handleHireCaptain,
  handleHireSailors,
} from './handlers/tavern';
import {
  handleBuyFromPeddler,
  handleBuyGoods,
  handleRentStall,
  handleSellAtStall,
  handleSellGoods,
  handleSellToLord,
  handleTransferGoods,
} from './handlers/trade';
import {
  handleAcceptContract,
  handleAcceptMission,
  handleDeliverContract,
  handleDeliverMissionGoods,
  handleProposeMotion,
  handleSetHeadTax,
  handleTreasuryTransfer,
} from './handlers/townhall';

export function dispatch(ctx: SimContext, command: Command): CommandResult {
  switch (command.type) {
    case 'Gather':
      return handleGather(ctx, command.activity, command.quality);
    case 'ChopWood':
      return handleGather(ctx, 'wood', command.quality);
    case 'WorkDayJob':
      return handleWorkDayJob(ctx, command.jobId);
    case 'BuyGoods':
      return handleBuyGoods(ctx, command.good, command.amount, command.into);
    case 'SellGoods':
      return handleSellGoods(ctx, command.good, command.amount, command.from);
    case 'TransferGoods':
      return handleTransferGoods(ctx, command.good, command.amount, command.from, command.to);
    case 'RentStall':
      return handleRentStall(ctx);
    case 'SellAtStall':
      return handleSellAtStall(ctx, command.good, command.amount, command.from);
    case 'BuyFromPeddler':
      return handleBuyFromPeddler(ctx);
    case 'SellToLord':
      return handleSellToLord(ctx, command.good, command.amount, command.from);
    case 'FoundKontor':
      return handleFoundKontor(ctx);
    case 'BuildWarehouse':
      return handleBuildWarehouse(ctx);
    case 'SetGuards':
      return handleSetGuards(ctx, command.cityId, command.count);
    case 'HireManager':
      return handleHireManager(ctx);
    case 'FireManager':
      return handleFireManager(ctx, command.cityId);
    case 'SetStandingOrder':
      return handleSetStandingOrder(ctx, command.cityId, command.good, command.order);
    case 'BuildBusiness':
      return handleBuildBusiness(ctx, command.businessType);
    case 'SetUtilization':
      return handleSetUtilization(ctx, command.businessId, command.utilization);
    case 'DemolishBusiness':
      return handleDemolishBusiness(ctx, command.businessId);
    case 'BuildHouse':
      return handleBuildHouse(ctx, command.houseType);
    case 'SetRentLevel':
      return handleSetRentLevel(ctx, command.houseId, command.level);
    case 'FundInfrastructure':
      return handleFundInfrastructure(ctx, command.infrastructure);
    case 'Pray':
      return handlePray(ctx);
    case 'Donate':
      return handleDonate(ctx, command.amount);
    case 'GiveAlms':
      return handleGiveAlms(ctx, command.goods, command.from);
    case 'TakeBath':
      return handleTakeBath(ctx);
    case 'Bribe':
      return handleBribe(ctx);
    case 'JoinGuild':
      return handleJoinGuild(ctx);
    case 'AnnounceFestival':
      return handleAnnounceFestival(ctx);
    case 'AcceptContract':
      return handleAcceptContract(ctx, command.contractId);
    case 'DeliverContract':
      return handleDeliverContract(ctx, command.contractId, command.amount, command.from);
    case 'ProposeMotion':
      return handleProposeMotion(ctx, command.motion);
    case 'SetHeadTax':
      return handleSetHeadTax(ctx, command.rate);
    case 'TreasuryTransfer':
      return handleTreasuryTransfer(ctx, command.amount);
    case 'AcceptMission':
      return handleAcceptMission(ctx, command.mission);
    case 'DeliverMissionGoods':
      return handleDeliverMissionGoods(ctx, command.good, command.amount, command.from);
    case 'TakeLoan':
      return handleTakeLoan(ctx, command.termIndex, command.amount);
    case 'RepayLoan':
      return handleRepayLoan(ctx, command.loanId);
    case 'GrantLoan':
      return handleGrantLoan(ctx, command.offerId);
    case 'ResolveDefault':
      return handleResolveDefault(ctx, command.loanId, command.choice);
    case 'AcceptQuest':
      return handleAcceptQuest(ctx, command.questId);
    case 'DeliverQuestGoods':
      return handleDeliverQuestGoods(ctx, command.questId, command.from);
    case 'BuyInformation':
      return handleBuyInformation(ctx);
    case 'HireSailors':
      return handleHireSailors(ctx, command.shipId, command.count);
    case 'DismissSailors':
      return handleDismissSailors(ctx, command.shipId, command.count);
    case 'HireCaptain':
      return handleHireCaptain(ctx, command.shipId);
    case 'OrderShip':
      return handleOrderShip(ctx, command.shipType, command.name);
    case 'RepairShip':
      return handleRepairShip(ctx, command.shipId);
    case 'RenameShip':
      return handleRenameShip(ctx, command.shipId, command.name);
    case 'SendShip':
      return handleSendShip(ctx, command.shipId, command.destination);
    case 'Travel':
      return handleTravel(ctx, command.destination, command.shipId);
    case 'ShipCargo':
      return handleShipCargo(ctx, command.good, command.amount, command.destination, command.from);
  }
}
