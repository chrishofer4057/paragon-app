import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { ConstructionPanel } from './construction-panel';
import { KontorPanel } from './kontor-panel';
import { MarketPanel } from './market-panel';
import { MessagesPanel, PossessionsPanel, ReputationPanel, SavePanel } from './player-panels';
import { BathhousePanel, GatePanel, GuildPanel, LenderPanel, MarketplacePanel } from './small-panels';
import { TavernPanel } from './tavern-panel';
import { TemplePanel } from './temple-panel';
import { TownhallPanel } from './townhall-panel';
import { ShipyardPanel, TravelPanel } from './travel-panels';

/** Zeigt das gerade geöffnete Fenster. Ortsgebundene Fenster nur, wenn die Figur in einer Stadt ist. */
@Component({
  selector: 'app-panel-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MarketPanel,
    TavernPanel,
    TemplePanel,
    BathhousePanel,
    GuildPanel,
    TownhallPanel,
    LenderPanel,
    ShipyardPanel,
    GatePanel,
    MarketplacePanel,
    KontorPanel,
    ConstructionPanel,
    ReputationPanel,
    PossessionsPanel,
    MessagesPanel,
    TravelPanel,
    SavePanel,
  ],
  template: `
    @if (game.panel(); as panel) {
      <div class="backdrop" (click)="game.closePanel()"></div>
      <div class="panel-slot">
        @switch (panel) {
          @case ('market') {
            <app-market-panel />
          }
          @case ('tavern') {
            <app-tavern-panel />
          }
          @case ('temple') {
            <app-temple-panel />
          }
          @case ('bathhouse') {
            <app-bathhouse-panel />
          }
          @case ('guild') {
            <app-guild-panel />
          }
          @case ('townhall') {
            <app-townhall-panel />
          }
          @case ('city') {
            <app-townhall-panel />
          }
          @case ('lender') {
            <app-lender-panel />
          }
          @case ('shipyard') {
            <app-shipyard-panel />
          }
          @case ('gate') {
            <app-gate-panel />
          }
          @case ('marketplace') {
            <app-marketplace-panel />
          }
          @case ('kontor') {
            <app-kontor-panel />
          }
          @case ('construction') {
            <app-construction-panel />
          }
          @case ('reputation') {
            <app-reputation-panel />
          }
          @case ('possessions') {
            <app-possessions-panel />
          }
          @case ('messages') {
            <app-messages-panel />
          }
          @case ('travel') {
            <app-travel-panel />
          }
          @case ('save') {
            <app-save-panel />
          }
        }
      </div>
    }
  `,
})
export class PanelHost {
  protected readonly game = inject(GameService);
}
