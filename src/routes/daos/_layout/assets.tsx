import { css } from "../../../../styled-system/css";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { BigIntMath, DenominatedNumber } from "@reactive-dot/utils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/daos/_layout/assets")({
  component: AssetsPage,
  beforeLoad: () => ({ title: "Assets" }),
});

function AssetsPage() {
  const coreId = useLazyLoadSelectedDaoId();

  if (coreId === undefined) {
    return <p>Please select a DAO</p>;
  }

  return <SuspendableAssetsPage />;

  function SuspendableAssetsPage() {
    const coreStorage = useLazyLoadQuery((builder) =>
      builder.readStorage("INV4", "CoreStorage", [coreId!]),
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

      return (
        <table className={css({ width: "stretch" })}>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Transferable</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id}>
                <td>{token.metadata.symbol.asText()}</td>
                <td>
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
                    token.metadata.symbol.asText(),
                  ).toLocaleString()}
                </td>
                <td>
                  {new DenominatedNumber(
                    BigIntMath.max(0n, token.value.free + token.value.reserved),
                    token.metadata.decimals,
                    token.metadata.symbol.asText(),
                  ).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }
}
