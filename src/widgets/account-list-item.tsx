import { css } from "../../styled-system/css";
import { ListItem } from "../components/list-item";
import type { IdentityData } from "@polkadot-api/descriptors";
import { idle } from "@reactive-dot/core";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { PolkadotIdenticon } from "dot-identicon/react.js";
import { Suspense } from "react";

export type AccountListItemProps = {
  address: string;
  name?: string;
};

export function AccountListItem({ address, name }: AccountListItemProps) {
  const shortenedAddress = address.slice(0, 4) + "..." + address.slice(-4);

  return (
    <div
      className={css({
        maxWidth: "100%",
        overflow: "hidden",
      })}
    >
      <ListItem
        headline={
          <Suspense
            fallback={
              <span
                className={css({
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                  maxWidth: "100%",
                })}
              >
                {name ?? shortenedAddress}
              </span>
            }
          >
            <span
              className={css({
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
                maxWidth: "100%",
              })}
            >
              <OnChainName />
            </span>
          </Suspense>
        }
        supporting={
          <span
            className={css({
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
              maxWidth: "100%",
            })}
          >
            {shortenedAddress}
          </span>
        }
        leading={
          <PolkadotIdenticon
            address={address}
            backgroundColor="var(--colors-content)"
          />
        }
      />
    </div>
  );

  function OnChainName() {
    const identity = useLazyLoadQuery(
      (builder) => builder.readStorage("Identity", "IdentityOf", [address]),
      { chainId: "polkadot_people" },
    );

    const superIdentity = useLazyLoadQuery(
      (builder) =>
        identity !== undefined
          ? undefined
          : builder.readStorage("Identity", "SuperOf", [address]),
      { chainId: "polkadot_people" },
    );

    const superAccountIdentity = useLazyLoadQuery(
      (builder) =>
        superIdentity === idle || superIdentity === undefined
          ? undefined
          : builder.readStorage("Identity", "IdentityOf", [superIdentity[0]]),
      { chainId: "polkadot_people" },
    );

    const getDisplay = (identityData: IdentityData | undefined) => {
      const value = identityData?.value;

      if (value === undefined) {
        return undefined;
      }

      if (typeof value === "number") {
        return value.toLocaleString();
      }

      return value.asText();
    };

    const identityDisplay =
      getDisplay(identity?.[0]?.info.display) ??
      (superIdentity === idle ||
      superIdentity === undefined ||
      superAccountIdentity === idle ||
      superAccountIdentity === undefined
        ? undefined
        : `${getDisplay(superAccountIdentity[0].info.display)}/${getDisplay(superIdentity[1])}`);

    return identityDisplay ?? name ?? shortenedAddress;
  }
}
