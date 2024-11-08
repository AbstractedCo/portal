import { polkadot_people, invarch } from "@polkadot-api/descriptors";
import { defineConfig } from "@reactive-dot/core";
import { InjectedWalletProvider } from "@reactive-dot/core/wallets.js";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import { getWsProvider } from "polkadot-api/ws-provider/web";

export const config = defineConfig({
  chains: {
    invarch: {
      descriptor: invarch,
      provider: withPolkadotSdkCompat(
        getWsProvider("wss://invarch-rpc.dwellir.com"),
      ),
    },
    polkadot_people: {
      descriptor: polkadot_people,
      provider: getWsProvider("wss://polkadot-people-rpc.polkadot.io"),
    },
  },
  targetChains: ["invarch"],
  wallets: [new InjectedWalletProvider()],
});
