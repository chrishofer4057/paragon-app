import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import type { CityId } from '../../sim/data/cities';
import { shipInPort, type StorageRef } from '../../sim/systems/storage';

export interface StorageOption {
  key: string;
  label: string;
  ref: StorageRef;
}

/** Alle Lagerorte, die in einer Stadt erreichbar sind: Rucksack, Kontor, Schiffe im Hafen. */
export function storageOptions(game: GameService, cityId: CityId): StorageOption[] {
  const state = game.state();
  if (!state) return [];
  const options: StorageOption[] = [{ key: 'inventory', label: 'Rucksack', ref: { kind: 'inventory' } }];
  if (state.player.kontors[cityId])
    options.push({ key: 'kontor', label: 'Kontor', ref: { kind: 'kontor', cityId } });
  if (state.player.holds[cityId])
    options.push({ key: 'hold', label: 'Hafenlager', ref: { kind: 'hold', cityId } });
  for (const ship of Object.values(state.ships)) {
    if (shipInPort(ship) === cityId && ship.repairUntilTick === null) {
      options.push({
        key: `ship:${ship.id}`,
        label: `Schiff ${ship.name}`,
        ref: { kind: 'ship', shipId: ship.id },
      });
    }
  }
  return options;
}

@Component({
  selector: 'app-storage-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="picker">
      {{ label() }}
      <select [value]="selected()" (change)="selected.set($any($event.target).value)">
        @for (o of options(); track o.key) {
          <option [value]="o.key">{{ o.label }}</option>
        }
      </select>
    </label>
  `,
})
export class StoragePicker {
  private readonly game = inject(GameService);
  readonly cityId = input.required<CityId>();
  readonly label = input('Lager:');
  readonly selected = model('inventory');
  readonly options = computed(() => storageOptions(this.game, this.cityId()));
}

export function resolveOption(options: StorageOption[], key: string): StorageRef {
  return options.find((o) => o.key === key)?.ref ?? { kind: 'inventory' };
}
