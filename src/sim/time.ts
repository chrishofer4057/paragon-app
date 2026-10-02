import { TIME } from './data/balance';

/**
 * Kalender. 1 Tick = 1 Spielstunde (Entscheidungslog). Der Kalender ist bewusst
 * vereinfacht: 12 Monate à 30 Tage, Wochen à 7 Tage laufen unabhängig davon durch.
 */

export const HOURS_PER_DAY = TIME.hoursPerDay;
export const HOURS_PER_WEEK = TIME.hoursPerDay * TIME.daysPerWeek;
export const DAYS_PER_YEAR = TIME.daysPerMonth * TIME.monthsPerYear;

/** Tick, an dem ein neues Spiel beginnt (relativ zu Jahr/Monat-Null). */
export const START_TICK = TIME.startMonth * TIME.daysPerMonth * HOURS_PER_DAY + TIME.startHour;

export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

export interface CalendarDate {
  /** Laufender Tag seit Kalender-Null. */
  day: number;
  hour: number;
  /** 1-basiert. */
  dayOfMonth: number;
  /** 0-basiert. */
  month: number;
  year: number;
  dayOfYear: number;
}

export function dayOf(tick: number): number {
  return Math.floor(tick / HOURS_PER_DAY);
}

export function hourOf(tick: number): number {
  return tick % HOURS_PER_DAY;
}

export function toDate(tick: number): CalendarDate {
  const day = dayOf(tick);
  const dayOfYear = day % DAYS_PER_YEAR;
  return {
    day,
    hour: hourOf(tick),
    dayOfMonth: (dayOfYear % TIME.daysPerMonth) + 1,
    month: Math.floor(dayOfYear / TIME.daysPerMonth),
    year: TIME.startYear + Math.floor(day / DAYS_PER_YEAR),
    dayOfYear,
  };
}

export function formatDate(tick: number): string {
  const d = toDate(tick);
  const hh = String(d.hour).padStart(2, '0');
  return `${d.dayOfMonth}. ${MONTH_NAMES[d.month]} ${d.year}, ${hh}:00`;
}

export function isWinter(tick: number): boolean {
  return TIME.winterMonths.includes(toDate(tick).month);
}

export function isStartOfDay(tick: number): boolean {
  return hourOf(tick) === 0;
}

export function isStartOfWeek(tick: number): boolean {
  return isStartOfDay(tick) && dayOf(tick) % TIME.daysPerWeek === 0;
}

export function isStartOfMonth(tick: number): boolean {
  return isStartOfDay(tick) && toDate(tick).dayOfMonth === 1;
}

export function daysToTicks(days: number): number {
  return Math.round(days * HOURS_PER_DAY);
}
