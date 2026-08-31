import { KOI_COUNT, type KoiSchool } from "./koi";

export enum FishingPhase {
  Idle = "idle",
  Waiting = "waiting",
  Nibble = "nibble",
  Bite = "bite",
  Reeling = "reeling",
}

export interface Point {
  x: number;
  y: number;
}

export const KOI_SPECIES = [
  { name: "红白锦鲤", min: 42, max: 58, body: "#fdfcf7", mark: "#e63212" },
  { name: "秋翠锦鲤", min: 38, max: 52, body: "#8ebac4", mark: "#e86a17" },
  { name: "黄金锦鲤", min: 45, max: 62, body: "#fcc02a", mark: "#df9b12" },
  { name: "白别甲", min: 40, max: 55, body: "#f5f5f0", mark: "#1a1e21" },
  { name: "丹顶锦鲤", min: 43, max: 60, body: "#fdfcf7", mark: "#d92518" },
  { name: "乌鲤", min: 39, max: 56, body: "#222629", mark: "#667078" },
] as const;

export interface Catch {
  palette: number;
  length: number;
}

type FishingState =
  | { phase: FishingPhase.Idle }
  | { phase: FishingPhase.Waiting; delay: number }
  | { phase: FishingPhase.Nibble | FishingPhase.Bite; fish: number }
  | { phase: FishingPhase.Reeling; fish: number; catch: Catch };

export interface FishingStatus {
  phase: FishingPhase;
  caught: number;
  catch?: Catch;
  missed?: boolean;
}

export const REEL_DURATION = 1.2;

export class Fishing {
  private current: FishingState = { phase: FishingPhase.Idle };
  private age = 0;
  private caught = 0;
  private aim: Point = { x: 1.5, y: 0.5 };
  readonly bobber: Point = { x: 1.5, y: 0.5 };

  constructor(
    private readonly koi: KoiSchool,
    private readonly addDrop: (u: number, v: number, amplitude: number) => void,
    private readonly onChange: (status: FishingStatus) => void,
  ) {}

  get state(): Readonly<FishingState> {
    return this.current;
  }

  get stateTime(): number {
    return this.age;
  }

  private transition(state: FishingState, missed = false): void {
    this.current = state;
    this.age = 0;
    this.onChange({
      phase: state.phase,
      caught: this.caught,
      catch: state.phase === FishingPhase.Reeling ? state.catch : undefined,
      missed,
    });
  }

  setActive(active: boolean): void {
    if (active === (this.current.phase !== FishingPhase.Idle)) {
      return;
    }
    this.aim = { ...this.bobber };
    this.transition(
      active ? { phase: FishingPhase.Waiting, delay: 0 } : { phase: FishingPhase.Idle },
    );
    if (active) {
      this.ripple(0.018);
    }
  }

  move(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    if (this.current.phase === FishingPhase.Waiting) {
      this.aim = { x: Math.max(0.08, Math.min(2.92, x)), y: Math.max(0.1, Math.min(0.9, y)) };
    }
  }

  constrain(left: number, right: number): void {
    this.aim.x = Math.max(left, Math.min(right, this.aim.x));
    this.bobber.x = Math.max(left, Math.min(right, this.bobber.x));
  }

  strike(): void {
    if (this.current.phase !== FishingPhase.Bite) {
      return;
    }
    const fish = this.current.fish;
    const palette = this.koi.b[fish * 4 + 3];
    const species = KOI_SPECIES[palette];
    this.transition({
      phase: FishingPhase.Reeling,
      fish,
      catch: {
        palette,
        length: Math.round(species.min + Math.random() * (species.max - species.min)),
      },
    });
    this.ripple(0.04);
  }

  private ripple(amplitude: number): void {
    this.addDrop(this.bobber.x / 3, this.bobber.y, amplitude);
  }

  private distanceToMouth(index: number): number {
    const offset = index * 4;
    const half = this.koi.b[offset] * 0.85;
    return Math.hypot(
      this.bobber.x - this.koi.a[offset] - this.koi.a[offset + 2] * half,
      this.bobber.y - this.koi.a[offset + 1] - this.koi.a[offset + 3] * half,
    );
  }

  private nearestFish(): number {
    let nearest = -1;
    let distance = 0.55;
    for (let i = 0; i < KOI_COUNT; i++) {
      const next = this.distanceToMouth(i);
      if (next < distance) {
        nearest = i;
        distance = next;
      }
    }
    return nearest;
  }

  update(t: number, dt: number): void {
    const previousAge = this.age;
    this.age += dt;
    const state = this.current;

    if (state.phase === FishingPhase.Waiting) {
      const blend = 1 - Math.exp(-dt * 10);
      const dx = (this.aim.x - this.bobber.x) * blend;
      const dy = (this.aim.y - this.bobber.y) * blend;
      this.bobber.x += dx;
      this.bobber.y += dy;
      if (Math.hypot(dx, dy) > 0.004) {
        this.ripple(0.004);
      }
    }

    const fish =
      "fish" in state
        ? state.fish
        : state.phase === FishingPhase.Waiting && this.age >= state.delay
          ? this.nearestFish()
          : -1;
    const underwater = fish >= 0 && state.phase !== FishingPhase.Reeling;
    this.koi.update(
      t,
      dt,
      underwater
        ? {
            index: fish,
            ...this.bobber,
            biting: state.phase === FishingPhase.Bite,
          }
        : undefined,
      state.phase === FishingPhase.Reeling ? fish : -1,
    );

    switch (state.phase) {
      case FishingPhase.Waiting:
        if (fish >= 0 && this.distanceToMouth(fish) < 0.06) {
          this.transition({ phase: FishingPhase.Nibble, fish });
          this.ripple(0.008);
        }
        break;
      case FishingPhase.Nibble:
        if (this.age >= 0.95) {
          this.transition({ phase: FishingPhase.Bite, fish });
          this.ripple(0.026);
        }
        break;
      case FishingPhase.Bite:
        if (Math.floor(this.age / 0.13) > Math.floor(previousAge / 0.13)) {
          this.ripple(0.014);
        }
        if (this.age >= 2) {
          this.transition({ phase: FishingPhase.Waiting, delay: 3 }, true);
          this.ripple(0.022);
        }
        break;
      case FishingPhase.Reeling:
        if (this.age >= REEL_DURATION) {
          this.caught++;
          this.transition({ phase: FishingPhase.Waiting, delay: 3 });
          this.ripple(0.025);
        }
        break;
      case FishingPhase.Idle:
        break;
    }
  }
}
