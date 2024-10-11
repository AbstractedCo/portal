import type { WalletAccount } from "@reactive-dot/core/wallets.js";
import { atom } from "jotai";

function atomWithLocalStorage<T>(key: string, initialValue: T) {
  const getInitialValue = () => {
    const item = localStorage.getItem(key);
    if (item !== null) {
      return JSON.parse(item);
    }
    return initialValue;
  };
  const baseAtom = atom(getInitialValue());
  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue =
        typeof update === "function" ? update(get(baseAtom)) : update;
      set(baseAtom, nextValue);
      localStorage.setItem(key, JSON.stringify(nextValue));
    },
  );
  return derivedAtom;
}

export const accountsAtom = atom<WalletAccount[]>([]);

export const selectedAccountIdAtom = atomWithLocalStorage<string | undefined>(
  "@invarch-portal/selected-account",
  undefined,
);

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
