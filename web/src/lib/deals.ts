"use client";

import { useQuery } from "@tanstack/react-query";
import { erc20Abi, type Address } from "viem";
import { useBlockNumber, usePublicClient } from "wagmi";
import { escrowAbi, ESCROW_ADDRESS, USDT_ADDRESS } from "./contract";
import { activeChain } from "./chain";

export enum Status {
  None,
  Funded,
  Accepted,
  Delivered,
  Disputed,
  Released,
  Refunded,
  Resolved,
}

export const STATUS_LABEL: Record<Status, string> = {
  [Status.None]: "Unknown",
  [Status.Funded]: "Waiting for seller",
  [Status.Accepted]: "In progress",
  [Status.Delivered]: "Delivered",
  [Status.Disputed]: "In dispute",
  [Status.Released]: "Paid out",
  [Status.Refunded]: "Refunded",
  [Status.Resolved]: "Settled by arbiter",
};

export const REVIEW_WINDOW = 3 * 86400;
export const isDeployed = ESCROW_ADDRESS !== "0x0000000000000000000000000000000000000000";

export type Deal = {
  id: bigint;
  buyer: Address;
  seller: Address;
  amount: bigint;
  feeBps: number;
  status: Status;
  createdAt: number;
  acceptBy: number;
  acceptedAt: number;
  deliveredAt: number;
  closedAt: number;
  buyerWantsCancel: boolean;
  sellerWantsCancel: boolean;
  disputedBy: Address;
  terms: string;
};

export const isOpen = (s: Status) =>
  s === Status.Funded || s === Status.Accepted || s === Status.Delivered || s === Status.Disputed;

const escrow = { address: ESCROW_ADDRESS, abi: escrowAbi } as const;

function useClient() {
  return usePublicClient({ chainId: activeChain.id });
}

/** Re-runs a query whenever a new block lands, so pages follow the chain without a refresh. */
function useBlockTick() {
  const { data } = useBlockNumber({ chainId: activeChain.id, watch: { pollingInterval: 4_000 } });
  return data ? Number(data / 2n) : 0; // every ~2 blocks is plenty
}

type Client = NonNullable<ReturnType<typeof useClient>>;

async function readDeal(client: Client, id: bigint): Promise<Deal | null> {
  try {
    const d = await client.readContract({ ...escrow, functionName: "getDeal", args: [id] });
    return {
      id,
      buyer: d.buyer,
      seller: d.seller,
      amount: d.amount,
      feeBps: d.feeBps,
      status: d.status as Status,
      createdAt: Number(d.createdAt),
      acceptBy: Number(d.acceptBy),
      acceptedAt: Number(d.acceptedAt),
      deliveredAt: Number(d.deliveredAt),
      closedAt: Number(d.closedAt),
      buyerWantsCancel: d.buyerWantsCancel,
      sellerWantsCancel: d.sellerWantsCancel,
      disputedBy: d.disputedBy,
      terms: d.terms,
    };
  } catch {
    return null;
  }
}

export function useDeal(id: bigint | null) {
  const client = useClient();
  const tick = useBlockTick();
  return useQuery({
    queryKey: ["deal", id?.toString(), tick],
    enabled: !!client && id !== null && isDeployed,
    placeholderData: (prev) => prev,
    queryFn: () => readDeal(client!, id!),
  });
}

export function useMyDeals(address: Address | undefined) {
  const client = useClient();
  const tick = useBlockTick();
  return useQuery({
    queryKey: ["my-deals", address, tick],
    enabled: !!client && !!address && isDeployed,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const [buying, selling] = await Promise.all([
        client!.readContract({ ...escrow, functionName: "dealsAsBuyer", args: [address!] }),
        client!.readContract({ ...escrow, functionName: "dealsAsSeller", args: [address!] }),
      ]);
      const load = async (ids: readonly bigint[]) =>
        (await Promise.all([...ids].reverse().map((id) => readDeal(client!, id)))).filter((d): d is Deal => !!d);
      const [b, s] = await Promise.all([load(buying), load(selling)]);
      return { buying: b, selling: s };
    },
  });
}

/** How many deals an address finished (with the other side's approval) on EscrowAgent. */
export function useTrackRecord(address: Address | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["track", address],
    enabled: !!client && !!address && isDeployed,
    staleTime: 30_000,
    queryFn: async () => {
      const [asSeller, asBuyer, code, nonce] = await Promise.all([
        client!.readContract({ ...escrow, functionName: "completedAsSeller", args: [address!] }),
        client!.readContract({ ...escrow, functionName: "completedAsBuyer", args: [address!] }),
        client!.getCode({ address: address! }),
        client!.getTransactionCount({ address: address! }),
      ]);
      return {
        asSeller: Number(asSeller),
        asBuyer: Number(asBuyer),
        isContract: !!code && code !== "0x",
        txCount: nonce,
      };
    },
  });
}

export function useProtocol() {
  const client = useClient();
  const tick = useBlockTick();
  return useQuery({
    queryKey: ["protocol", tick],
    enabled: !!client && isDeployed,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    queryFn: async () => {
      const [dealCount, totalVolume, feeBps, arbiter, locked] = await Promise.all([
        client!.readContract({ ...escrow, functionName: "dealCount" }),
        client!.readContract({ ...escrow, functionName: "totalVolume" }),
        client!.readContract({ ...escrow, functionName: "feeBps" }),
        client!.readContract({ ...escrow, functionName: "arbiter" }),
        client!.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [ESCROW_ADDRESS] }),
      ]);
      return { dealCount: Number(dealCount), totalVolume, feeBps: Number(feeBps), arbiter, locked };
    },
  });
}

export function useUsdtBalance(address: Address | undefined) {
  const client = useClient();
  const tick = useBlockTick();
  return useQuery({
    queryKey: ["usdt", address, tick],
    enabled: !!client && !!address,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const [balance, allowance] = await Promise.all([
        client!.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address!] }),
        client!.readContract({
          address: USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address!, ESCROW_ADDRESS],
        }),
      ]);
      return { balance, allowance };
    },
  });
}

/** USD→NGN from a free, keyless API. Cached for an hour. */
export function useNairaRate() {
  return useQuery({
    queryKey: ["ngn"],
    staleTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const json = (await res.json()) as { rates?: Record<string, number> };
      return json.rates?.NGN;
    },
  });
}

export function feeFor(amount: bigint, feeBps: number): bigint {
  const fee = (amount * BigInt(feeBps)) / 10_000n;
  return fee > 5_000_000n ? 5_000_000n : fee;
}
