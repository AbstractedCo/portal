import { css } from "../../../../styled-system/css";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { BigIntMath, DenominatedNumber } from "@reactive-dot/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Binary } from "polkadot-api";

export const Route = createFileRoute("/daos/_layout/assets")({
  component: AssetsPage,
  beforeLoad: () => ({ title: "Assets" }),
});

function AssetsPage() {
  const daoId = useLazyLoadSelectedDaoId();

  if (daoId === undefined) {
    return <p>Please select a DAO</p>;
  }

  return <SuspendableAssetsPage />;

  function SuspendableAssetsPage() {
    const coreStorage = useLazyLoadQuery((builder) =>
      builder.readStorage("INV4", "CoreStorage", [daoId!]),
    );

    if (coreStorage === undefined) {
      return null;
    }

    return <SuspendableCoreTokens />;

    function SuspendableCoreTokens() {
      const coreTokens = useLazyLoadQuery((builder) =>
        builder.readStorageEntries("Tokens", "Accounts", [
          coreStorage!.account,
        ]),
      );

      const nativeBalance = useLazyLoadQuery((builder) =>
        builder.readStorage("System", "Account", [
          coreStorage!.account,
        ]),
      ).data;

      const assetMetadata = useLazyLoadQuery((builder) =>
        builder.readStorages(
          "AssetRegistry",
          "Metadata",
          coreTokens.map((token) => [token.keyArgs[1]] as const),
        ),
      );

      const tokens = coreTokens.map((token, index) => ({
        id: token.keyArgs[1],
        value: token.value,
        metadata: assetMetadata.at(index)!,
      }));

      tokens.push({
        id: 0,
        value: nativeBalance,
        metadata: {
          symbol: Binary.fromText("VARCH"),
          name: Binary.fromText("InvArch"),
          decimals: 12,
          existential_deposit: 1000000000000000000000000n,
          location: undefined,
          additional: 0n,
        },
      });

      return (
        <table className={css({
          width: "stretch",
          borderCollapse: "collapse",
        })}>
          <thead>
            <tr>
              <th className={css({
                textAlign: "left",
                padding: "1rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
              })}>Asset</th>
              <th className={css({
                textAlign: "right",
                padding: "1rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
              })}>Transferable</th>
              <th className={css({
                textAlign: "right",
                padding: "1rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
              })}>Total</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id}>
                <td className={css({
                  textAlign: "left",
                  padding: "1rem"
                })}>{token.metadata.symbol.asText()}</td>
                <td className={css({
                  textAlign: "right",
                  padding: "1rem"
                })}>
                  {new DenominatedNumber(
                    BigIntMath.max(
                      0n,
                      token.value.free -
                      BigIntMath.max(
                        token.value.frozen - token.value.reserved,
                        0n,
                      ),
                    ),
                    token.metadata.decimals,
                  ).toLocaleString() + " " + token.metadata.symbol.asText()}

                </td>
                <td className={css({
                  textAlign: "right",
                  padding: "1rem"
                })}>
                  {new DenominatedNumber(
                    BigIntMath.max(0n, token.value.free + token.value.reserved),
                    token.metadata.decimals,
                  ).toLocaleString() + " " + token.metadata.symbol.asText()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }
}
