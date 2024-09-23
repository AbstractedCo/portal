import { tinkernet } from "@polkadot-api/descriptors";
import type { Config } from "@reactive-dot/core";
import { InjectedWalletAggregator } from "@reactive-dot/core/wallets.js";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";

export const config = {
  chains: {
    tinkernet: {
      descriptor: tinkernet,
      provider: withPolkadotSdkCompat(
        getWsProvider("wss://tinkernet-rpc.dwellir.com"),
      ),
    },
  },
  wallets: [new InjectedWalletAggregator()],
} satisfies Config;
