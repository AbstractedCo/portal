import {
  polkadot_people,
  invarch,
  polkadot_asset_hub,
} from "@polkadot-api/descriptors";
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
        // getWsProvider("ws://localhost:8000"),
      ),
    },
    polkadot_asset_hub: {
      descriptor: polkadot_asset_hub,
      provider: getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"),
      // provider: getWsProvider("ws://localhost:8001"),
    },
    polkadot_people: {
      descriptor: polkadot_people,
      provider: getWsProvider("wss://polkadot-people-rpc.polkadot.io"),
    },
  },
  targetChains: ["invarch"],
  wallets: [new InjectedWalletProvider()],
});
