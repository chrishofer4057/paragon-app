import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameService } from '../bridge/game.service';
import { GameScreen } from './game-screen';
import { TitleScreen } from './title-screen';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleScreen, GameScreen],
  template: `
    @if (game.running()) {
      <app-game-screen />
    } @else {
      <app-title-screen />
    }
  `,
})
export class App {
  protected readonly game = inject(GameService);
}
