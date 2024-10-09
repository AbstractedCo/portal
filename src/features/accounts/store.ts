import type { WalletAccount } from "@reactive-dot/core/wallets.js";
import { atom } from "jotai";

export const accountsAtom = atom<WalletAccount[]>([]);

export const selectedAccountIdAtom = atom<string>();

export const selectedAccountAtom = atom(
  (get) => {
    const selectedAccountId = get(selectedAccountIdAtom);

    if (selectedAccountId === undefined) {
      return;
    }

    return get(accountsAtom).find(
      (account) => account.wallet.id + account.address === selectedAccountId,
    );
  },
  (_, set, account: WalletAccount) =>
    set(selectedAccountIdAtom, account.wallet.id + account.address),
);
