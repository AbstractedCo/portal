import { ListItem } from "./list-item";
import { PolkadotIdenticon } from "dot-identicon/react.js";

export function Default() {
  return (
    <ListItem
      headline="InVarch EmbassyDAO"
      supporting="5CLw...ebXJ"
      leading={
        <PolkadotIdenticon address="5CLwQ5xmYfBshb9cwndyybRwbc673Rhh4f6s3i3qXbfDebXJ" />
      }
    />
  );
}
