import { polkadot_people, tinkernet } from "@polkadot-api/descriptors";
import { defineConfig } from "@reactive-dot/core";
import { InjectedWalletAggregator } from "@reactive-dot/core/wallets.js";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";

export const config = defineConfig({
  chains: {
    tinkernet: {
      descriptor: tinkernet,
      provider: withPolkadotSdkCompat(
        getWsProvider("wss://tinkernet-rpc.dwellir.com"),
      ),
    },
    polkadot_people: {
      descriptor: polkadot_people,
      provider: getWsProvider("wss://polkadot-people-rpc.polkadot.io"),
    },
  },
  targetChains: ["tinkernet"],
  wallets: [new InjectedWalletAggregator()],
});
