import { Pipe, type PipeTransform } from '@angular/core';

const nf0 = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function gold(value: number): string {
  return `${nf0.format(Math.round(value))} GS`;
}

/** Goldstücke: "1’234 GS". */
@Pipe({ name: 'gold' })
export class GoldPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '–' : gold(value);
  }
}

/** Mengen: ganze Zahlen ohne, kleine Mengen mit Nachkommastellen. */
@Pipe({ name: 'qty' })
export class QtyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '–';
    if (Math.abs(value) >= 100) return nf0.format(value);
    if (Math.abs(value) >= 10) return nf1.format(value);
    return nf2.format(value);
  }
}

/** Prozent aus 0..1. */
@Pipe({ name: 'pct' })
export class PctPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '–' : `${nf0.format(value * 100)} %`;
  }
}

/** Ansehenspunkte mit einer Nachkommastelle. */
@Pipe({ name: 'rep' })
export class RepPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '–' : nf1.format(value);
  }
}

export const FORMAT_PIPES = [GoldPipe, QtyPipe, PctPipe, RepPipe] as const;
