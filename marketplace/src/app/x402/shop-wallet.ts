import { createPublicClient, createWalletClient, custom, defineChain, http, parseAbi, type Address } from "viem";
import { paymentDomain, walletErrorCode, walletErrorMessage } from "@/lib/agent-purchase";

const chain = defineChain({
  id: paymentDomain.chainId,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.whitechain.io"] } },
  blockExplorers: { default: { name: "Whitechain Explorer", url: "https://explorer.testnet.whitechain.io" } },
  testnet: true,
});
const publicClient = createPublicClient({ chain, transport: http(undefined, { timeout: 8000, retryCount: 0 }) });

export function injectedProvider() {
  return (window as Window & { ethereum?: Parameters<typeof custom>[0] & {
    on?: (event: string, callback: () => void) => void;
    removeListener?: (event: string, callback: () => void) => void;
  } }).ethereum;
}

export function browserWallet() {
  const provider = injectedProvider();
  if (!provider) throw new Error("Open the store in a browser with an Ethereum wallet extension, then connect.");
  return createWalletClient({ chain, transport: custom(provider) });
}

export async function readShopWallet(address: Address) {
  const [balance, gasBalance] = await Promise.all([
    usdtBalance(address), publicClient.getBalance({ address }).catch(() => null),
  ]);
  return { address, balance, gasBalance };
}

export async function shopWalletAddress() {
  const wallet = browserWallet();
  const [addresses, chainId] = await Promise.all([wallet.getAddresses(), wallet.getChainId()]);
  return chainId === chain.id ? addresses[0] : undefined;
}

export async function checkShopWallet(address: Address) {
  const wallet = browserWallet();
  const [current] = await wallet.getAddresses().catch((error) => {
    throw new Error(walletErrorMessage(error, "connect"));
  });
  const chainId = await wallet.getChainId().catch((error) => {
    throw new Error(walletErrorMessage(error, "network"));
  });
  if (!current || current.toLowerCase() !== address.toLowerCase() || chainId !== chain.id) {
    throw new Error("Wallet account or network changed. Connect again before paying.");
  }
  return readShopWallet(current);
}

export async function usdtBalance(address: Address) {
  try {
    return await publicClient.readContract({
      address: paymentDomain.verifyingContract,
      abi: parseAbi(["function balanceOf(address owner) view returns (uint256)"]),
      functionName: "balanceOf",
      args: [address],
    });
  } catch (error) {
    throw new Error(walletErrorMessage(error, "balance"));
  }
}

export async function connectShopWallet(chooseAccount = false) {
  const wallet = browserWallet();
  const [address] = await (async () => {
    if (!chooseAccount) return wallet.requestAddresses();
    await wallet.requestPermissions({ eth_accounts: {} });
    return wallet.getAddresses();
  })().catch((error) => {
    if (chooseAccount && [4200, -32601].includes(walletErrorCode(error) ?? 0)) {
      throw new Error("Use your wallet extension to share the new account with this site.");
    }
    throw new Error(walletErrorMessage(error, "connect"));
  });
  if (!address) throw new Error("Select an account in your wallet.");
  try {
    if (await wallet.getChainId() !== chain.id) {
      try {
        await wallet.switchChain({ id: chain.id });
      } catch (error) {
        if (walletErrorCode(error) !== 4902) throw error;
        await wallet.addChain({ chain });
        await wallet.switchChain({ id: chain.id });
      }
      if (await wallet.getChainId() !== chain.id) throw new Error("Wrong network");
    }
  } catch (error) {
    throw new Error(walletErrorMessage(error, "network"));
  }
  return readShopWallet(address);
}
