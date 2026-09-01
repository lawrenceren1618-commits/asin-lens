import { addCalendarDays } from "../time";

export type ChangeLogRange = {
  id: string;
  effectiveFrom: string | Date;
  effectiveTo: string | Date;
};

export type ChangeLogDecision =
  | { type: "noop" }
  | { type: "extend"; previousId: string; effectiveTo: string }
  | { type: "update_in_place"; previousId: string }
  | {
      type: "insert";
      closePrevious: { id: string; effectiveTo: string } | null;
    };

function isoDay(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value.slice(0, 10);
}

/**
 * Decide how to write asin_change_log for one collect day.
 * Gap after a closed range (effectiveTo < day) keeps the old row and inserts a new one.
 */
export function planChangeLogWrite(input: {
  day: string;
  changed: boolean;
  previous: ChangeLogRange | null;
}): ChangeLogDecision {
  const day = isoDay(input.day);
  const previous = input.previous
    ? {
        id: input.previous.id,
        effectiveFrom: isoDay(input.previous.effectiveFrom),
        effectiveTo: isoDay(input.previous.effectiveTo),
      }
    : null;

  if (!input.changed) {
    if (!previous) return { type: "noop" };
    return {
      type: "extend",
      previousId: previous.id,
      effectiveTo: day,
    };
  }

  if (!previous) {
    return { type: "insert", closePrevious: null };
  }

  if (previous.effectiveTo === day) {
    return { type: "update_in_place", previousId: previous.id };
  }

  if (previous.effectiveTo < day) {
    return { type: "insert", closePrevious: null };
  }

  const end = addCalendarDays(day, -1);
  return {
    type: "insert",
    closePrevious:
      end >= previous.effectiveFrom
        ? { id: previous.id, effectiveTo: end }
        : null,
  };
}
