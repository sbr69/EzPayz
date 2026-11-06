"use client";

import { Wallet } from "lucide-react";
import { formatUnits } from "viem";
import { useShopWallet } from "@/features/storefront/wallet-context";
import { WalletStatus } from "@/components/ui/wallet-status";

const wbtFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3, useGrouping: false });

export function WalletMenu() {
  const { connected, connecting, connect, disconnect, walletError } = useShopWallet();
  return (
    <details className="relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[#D6CCBD] px-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
        {connected || connecting ? <WalletStatus connected={Boolean(connected)} connecting={connecting} /> : <>
          <Wallet size={16} aria-hidden />
          <span className="hidden min-[370px]:inline">Connect wallet</span><span className="min-[370px]:hidden">Wallet</span>
        </>}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-6rem)] rounded-xl border border-[#D6CCBD] bg-[#fffdf8] p-4 text-sm shadow-lg">
        <p className="font-semibold">Whitechain Sepolia</p>
        <p className="mt-1 text-xs text-[#565A64]">Testnet · Chain 1874</p>
        {connected ? (
          <>
            <a className="mt-3 block break-all font-mono text-xs underline" href={`https://explorer.testnet.whitechain.io/address/${connected.address}`}>{connected.address}</a>
            <dl className="my-3 space-y-2 border-y border-[#D6CCBD] py-3">
              <div className="flex justify-between gap-2"><dt>Test USDT</dt><dd className="break-all font-semibold">{formatUnits(connected.balance, 6)}</dd></div>
              <div className="flex justify-between gap-2"><dt>Test WBT</dt><dd className="break-all">{connected.gasBalance === null ? "Unavailable" : wbtFormatter.format(formatUnits(connected.gasBalance, 18) as `${number}`)}</dd></div>
            </dl>
          </>
        ) : <p className="my-3 text-xs text-[#565A64]">Connect your browser wallet to see balances and check out.</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="text-xs font-semibold underline disabled:opacity-50" disabled={connecting} onClick={() => void connect()}>
            {connecting ? "Connecting…" : connected ? "Refresh balances" : "Connect wallet"}
          </button>
          {connected && <button type="button" className="text-xs underline disabled:opacity-50" disabled={connecting} onClick={() => void connect(true)}>Change account</button>}
          {connected && <button type="button" className="text-xs underline" onClick={disconnect}>Disconnect from shop</button>}
        </div>
        {walletError && <p role="status" className="mt-3 text-xs text-red-800">{walletError}</p>}
      </div>
    </details>
  );
}
