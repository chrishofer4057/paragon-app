/**
 * Bildschirm-Overlay der 3D-Welt (reines DOM, kein Angular): Hinweis am Mauszeiger,
 * Fortschrittsbalken, Schwebetexte, Minispiel und Überblendung. Gestaltung in styles.scss
 * unter `.world-overlay`.
 */
export class Overlay {
  readonly root: HTMLDivElement;
  private readonly tooltip: HTMLDivElement;
  private readonly busy: HTMLDivElement;
  private readonly busyFill: HTMLDivElement;
  private readonly fade: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private minigameEl: HTMLDivElement | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'world-overlay');
    this.tooltip = el('div', 'world-tooltip');
    this.busy = el('div', 'world-busy');
    this.busyFill = el('div', 'world-busy-fill');
    this.busy.append(this.busyFill);
    this.fade = el('div', 'world-fade');
    this.banner = el('div', 'world-banner');
    this.root.append(this.tooltip, this.busy, this.banner, this.fade);
    parent.append(this.root);
    this.hideTooltip();
    this.showBusy(null);
  }

  showTooltip(text: string, x: number, y: number): void {
    this.tooltip.textContent = text;
    this.tooltip.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 12)}px)`;
    this.tooltip.style.display = 'block';
  }

  hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }

  /** Fortschritt 0..1 über einer Bildschirmposition; `null` blendet aus. */
  showBusy(progress: number | null, x = 0, y = 0): void {
    if (progress === null) {
      this.busy.style.display = 'none';
      return;
    }
    this.busy.style.display = 'block';
    this.busy.style.transform = `translate(${Math.round(x - 24)}px, ${Math.round(y)}px)`;
    this.busyFill.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
  }

  floatText(text: string, x: number, y: number, color: string): void {
    const t = el('div', 'world-float');
    t.textContent = text;
    t.style.left = `${Math.round(x)}px`;
    t.style.top = `${Math.round(y)}px`;
    t.style.color = color;
    this.root.append(t);
    setTimeout(() => t.remove(), 1700);
  }

  setBanner(text: string | null): void {
    this.banner.textContent = text ?? '';
    this.banner.style.display = text ? 'block' : 'none';
  }

  /** Kurz schwarz überblenden (Szenenwechsel). */
  flash(color = '#000', ms = 350): void {
    this.fade.style.transition = 'none';
    this.fade.style.background = color;
    this.fade.style.opacity = '1';
    requestAnimationFrame(() => {
      this.fade.style.transition = `opacity ${ms}ms ease-out`;
      this.fade.style.opacity = '0';
    });
  }

  openMinigame(title: string, hint: string, withBar: boolean, zone?: { center: number; half: number }): void {
    this.closeMinigame();
    const box = el('div', 'world-minigame');
    const h = el('div', 'mg-title');
    h.textContent = title;
    box.append(h);
    if (withBar && zone) {
      const bar = el('div', 'mg-bar');
      const z = el('div', 'mg-zone');
      z.style.left = `${(zone.center - zone.half) * 100}%`;
      z.style.width = `${zone.half * 200}%`;
      const sweet = el('div', 'mg-sweet');
      sweet.style.left = `${zone.center * 100}%`;
      const marker = el('div', 'mg-marker');
      bar.append(z, sweet, marker);
      box.append(bar);
    }
    const hintEl = el('div', 'mg-hint');
    hintEl.textContent = hint;
    box.append(hintEl);
    this.root.append(box);
    this.minigameEl = box;
  }

  setMinigameMarker(pos: number): void {
    const marker = this.minigameEl?.querySelector<HTMLDivElement>('.mg-marker');
    if (marker) marker.style.left = `${pos * 100}%`;
  }

  setMinigameHint(text: string, alert = false): void {
    const hint = this.minigameEl?.querySelector<HTMLDivElement>('.mg-hint');
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle('alert', alert);
  }

  closeMinigame(): void {
    this.minigameEl?.remove();
    this.minigameEl = null;
  }

  dispose(): void {
    this.root.remove();
  }
}

function el(tag: 'div', className: string): HTMLDivElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
