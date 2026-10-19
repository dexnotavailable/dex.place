// Which drawing plays each thing she does (slots.json roles), in each form, and the fallbacks so no role she can reach
// ever draws the white box (PLAN-10-19 lane A item 6): in the ult form a role with no ult drawing (none planned, or not
// slotted yet) plays its normal-form drawing. Pure, no browser: the loader (anims.ts) and the tests use it.

import slotsRaw from "./slots.json?raw";

export interface RoleDef {
  normal: string | null;
  ult: string | null;
  hold?: boolean;
  reverse?: boolean;
}

export interface SlotsFile {
  roles: Record<string, RoleDef>;
  jumpArc: { apex: number; contact: number };
}

export const SLOTS = JSON.parse(slotsRaw) as SlotsFile;

/** The slots a role may play in a form, best first: the form's own, then (ult form) the normal one. */
export function slotChoices(role: string, ult: boolean, slots: SlotsFile = SLOTS): string[] {
  const d = slots.roles[role];
  if (!d) return [];
  const ids = ult ? [d.ult, d.normal] : [d.normal];
  return [...new Set(ids.filter((v): v is string => !!v))];
}

/** The slot a role plays now: the first choice that is loaded (null: none is: the white box). */
export function slotFor(role: string, ult: boolean, has: (id: string) => boolean, slots: SlotsFile = SLOTS): string | null {
  return slotChoices(role, ult, slots).find(has) ?? null;
}

/**
 * Every role the game can play, per form (controller.ts and draw.ts: locomotion, the moves and their returns, the
 * reactions, R's beats; the opening poses walk). run_stop is out (Dex 10-19); R starts only in the normal form and
 * ends in the form (r_reveal), the form's exit plays the transform reversed (uf_exit).
 */
export const REACHABLE: { normal: string[]; ult: string[] } = {
  normal: [
    "idle", "walk", "run", "jump", "dash", "m1_1", "m1_2", "m1_3", "m1_4", "m1_1_ret", "m1_2_ret", "m1_3_ret", "m1_4_ret",
    "skill_q", "e_tap", "hurt", "knockdown", "defeat", "respawn", "r_call", "r_flurry", "transform", "r_reveal",
  ],
  ult: [
    "idle", "run", "jump", "dash", "m1_1", "m1_2", "m1_3", "m1_4", "m1_1_ret", "m1_2_ret", "m1_3_ret", "m1_4_ret",
    "skill_q", "e_tap", "hurt", "knockdown", "defeat", "r_reveal", "uf_exit",
  ],
};
