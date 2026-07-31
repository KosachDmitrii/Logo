import { rpc } from "@/backend/lib/supabase";

/** Prepaid units for expensive studio actions — named to match brand language. */
export const SIGNAL_COSTS = {
  generateBatch: 4,
  extraConcept: 1,
  refine: 2,
  vectorize: 1,
} as const;

export type SignalAction = keyof typeof SIGNAL_COSTS;

export const WELCOME_SIGNALS = 4;

export type SignalPack = {
  id: string;
  label: string;
  signals: number;
  priceUsd: number;
  blurb: string;
};

/** Creative packs — not generic SaaS tiers. */
export const SIGNAL_PACKS: SignalPack[] = [
  {
    id: "spark",
    label: "Spark",
    signals: 12,
    priceUsd: 14,
    blurb: "One full loop: brief → four concepts → refine → vector.",
  },
  {
    id: "studio",
    label: "Studio",
    signals: 40,
    priceUsd: 39,
    blurb: "Room to explore territories and lock a mark properly.",
  },
  {
    id: "atelier",
    label: "Atelier",
    signals: 120,
    priceUsd: 99,
    blurb: "A working stock for multiple brands in the same season.",
  },
];

export function packById(id: string): SignalPack | null {
  return SIGNAL_PACKS.find((pack) => pack.id === id) ?? null;
}

export function signalCost(action: SignalAction): number {
  return SIGNAL_COSTS[action];
}

export class InsufficientSignalsError extends Error {
  readonly code = "INSUFFICIENT_SIGNALS";
  constructor(public readonly required: number) {
    super(
      `Not enough signals. This action needs ${required}. Top up your studio to continue.`,
    );
    this.name = "InsufficientSignalsError";
  }
}

function isInsufficient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /INSUFFICIENT_SIGNALS/i.test(message);
}

export async function spendSignals(
  email: string,
  action: SignalAction,
  ref?: string,
): Promise<number> {
  const amount = signalCost(action);
  try {
    return await rpc<number>("spend_studio_signals", {
      p_email: email,
      p_amount: amount,
      p_reason: action,
      p_ref: ref ?? null,
    });
  } catch (error) {
    if (isInsufficient(error)) throw new InsufficientSignalsError(amount);
    throw error;
  }
}

export async function refundSignals(
  email: string,
  action: SignalAction,
  ref?: string,
): Promise<number> {
  return rpc<number>("grant_studio_signals", {
    p_email: email,
    p_amount: signalCost(action),
    p_reason: `refund:${action}`,
    p_ref: ref ?? null,
  });
}

export async function grantWelcomeSignals(email: string): Promise<number> {
  return rpc<number>("grant_studio_signals", {
    p_email: email,
    p_amount: WELCOME_SIGNALS,
    p_reason: "welcome",
    p_ref: "first-session",
  });
}

export async function grantPackSignals(
  email: string,
  pack: SignalPack,
  stripeSessionId: string,
): Promise<number> {
  return rpc<number>("grant_studio_signals", {
    p_email: email,
    p_amount: pack.signals,
    p_reason: `pack:${pack.id}`,
    p_ref: stripeSessionId,
  });
}
