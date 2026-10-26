export type Weapon = {
  name: string;
  damage: number;
  rate: number;
  mag: number;
  reserve: number;
  spread: number;
  range: number;
  color: number;
};
export const WEAPONS: Weapon[] = [
  {
    name: "AR-06 CARBINE",
    damage: 18,
    rate: 0.13,
    mag: 24,
    reserve: 120,
    spread: 0.012,
    range: 90,
    color: 0xe4b56b,
  },
  {
    name: "QUILL-9 SMG",
    damage: 13,
    rate: 0.075,
    mag: 32,
    reserve: 160,
    spread: 0.022,
    range: 65,
    color: 0x75d8d0,
  },
  {
    name: "MESA-7 MARKSMAN",
    damage: 38,
    rate: 0.42,
    mag: 10,
    reserve: 60,
    spread: 0.006,
    range: 125,
    color: 0xd7a881,
  },
];
