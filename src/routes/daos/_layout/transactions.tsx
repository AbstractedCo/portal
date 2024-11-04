import { css } from "../../../../styled-system/css";
import { Accordion } from "../../../components/accordion";
import { Button } from "../../../components/button";
import { CircularProgressIndicator } from "../../../components/circular-progress-indicator";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { AccountListItem } from "../../../widgets/account-list-item";
import { useLazyLoadQuery, useTypedApi } from "@reactive-dot/react";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { use } from "react18-use";

export const Route = createFileRoute("/daos/_layout/transactions")({
  component: TransactionsPage,
  beforeLoad: () => ({ title: "Transactions" }),
});

function TransactionsPage() {
  const daoId = useLazyLoadSelectedDaoId();

  if (daoId === undefined) {
    return null;
  }

  return <SuspendableTransactionPage daoId={daoId} />;
}

type SuspendableTransactionPageProps = {
  daoId: number;
};

function SuspendableTransactionPage({
  daoId,
}: SuspendableTransactionPageProps) {
  const calls = useLazyLoadQuery((builder) =>
    builder.readStorageEntries("INV4", "Multisig", [daoId]),
  ).map(({ value }) => value);

  const api = useTypedApi();

  if (calls.length === 0) {
    return null;
  }

  return (
    <section
      className={css({
        borderRadius: "1rem",
        backgroundColor: "container",
        padding: "2rem",
      })}
    >
      <Accordion>
        {calls.map((call, index) => {
          return <MultisigCall key={index} />;

          function MultisigCall() {
            const transactionPromise = useMemo(
              () => api.txFromCallData(call.actual_call),
              [],
            );

            return (
              <Accordion.Item
                value={index.toString()}
                summary={
                  <Suspense fallback={<CircularProgressIndicator size="1lh" />}>
                    <SuspendableSummary />
                  </Suspense>
                }
              >
                <div
                  className={css({
                    containerType: "inline-size",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2rem",
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                      "@container(min-width: 70rem)": {
                        flexDirection: "row",
                      },
                    })}
                  >
                    <code
                      className={css({
                        display: "block",
                        maxHeight: "20rem",
                        borderRadius: "1rem",
                        backgroundColor: "surface",
                        padding: "2rem",
                        overflow: "auto",
                        "@container(min-width: 70rem)": { flex: 1 },
                      })}
                    >
                      <pre>
                        <Suspense>
                          <SuspendableCallDetails />
                        </Suspense>
                      </pre>
                    </code>
                    <ul
                      className={css({
                        maxHeight: "20rem",
                        border: "1px solid {colors.outlineVariant}",
                        borderRadius: "0.3rem",
                        padding: "1rem",
                        overflow: "auto",
                        "@container(min-width: 70rem)": { flex: "0 1 15rem" },
                      })}
                    >
                      {call.tally.records.map(([address, vote]) => (
                        <li key={address}>
                          <AccountListItem address={address} />
                          Voted {vote.type.toLocaleLowerCase()} with{" "}
                          {vote.value.toLocaleString()} votes
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <progress
                      max={Number(call.tally.ayes + call.tally.nays)}
                      value={Number(call.tally.ayes)}
                      className={css({ width: "stretch" })}
                    />
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      gap: "1rem",
                      "&>*": { flex: 1 },
                    })}
                  >
                    <Button>Aye</Button>
                    <Button>Nay</Button>
                  </div>
                </div>
              </Accordion.Item>
            );

            function SuspendableSummary() {
              const transaction = use(transactionPromise) as Awaited<
                typeof transactionPromise
              >;

              return `Execute ${transaction.decodedCall.type}.${transaction.decodedCall.value.type}`;
            }

            function SuspendableCallDetails() {
              const transaction = use(transactionPromise) as Awaited<
                typeof transactionPromise
              >;

              return JSON.stringify(
                transaction.decodedCall,
                (_, value) =>
                  typeof value === "bigint" ? value.toString() : value,
                2,
              );
            }
          }
        })}
      </Accordion>
    </section>
  );
}
