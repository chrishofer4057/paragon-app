import { computed, type Signal } from '@angular/core';
import type { GameService } from '../../bridge/game.service';
import type { CityId } from '../../sim/data/cities';
import { cityView, currentCityId, type CityView } from '../../sim/selectors';

/** Aktuelle Stadt der Figur als Signal (null auf Reisen). */
export function useCity(game: GameService): { cityId: Signal<CityId | null>; city: Signal<CityView | null> } {
  const cityId = computed(() => {
    const state = game.state();
    return state ? currentCityId(state) : null;
  });
  const city = computed(() => {
    const state = game.state();
    const id = cityId();
    return state && id ? cityView(state, id) : null;
  });
  return { cityId, city };
}
