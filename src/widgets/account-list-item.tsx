import { ListItem } from "../components/list-item";
import { PolkadotIdenticon } from "dot-identicon/react.js";

export type AccountListItemProps = {
  address: string;
  name?: string | undefined;
};

export function AccountListItem({ address, name }: AccountListItemProps) {
  const shortenedAddress = address.slice(0, 4) + "..." + address.slice(-4);

  return (
    <ListItem
      headline={name ?? shortenedAddress}
      supporting={name === undefined ? undefined : shortenedAddress}
      leading={
        <PolkadotIdenticon
          address={address}
          backgroundColor="var(--colors-content)"
        />
      }
    />
  );
}
