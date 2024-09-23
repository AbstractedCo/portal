import { css, cx } from "../../styled-system/css";
import { Avatar } from "../components/avatar";
import {
  useLazyLoadQuery,
  useNativeTokenAmountFromPlanck,
} from "@reactive-dot/react";
import { Suspense } from "react";

export function RegisteredDaos() {
  const ocifCores = useLazyLoadQuery((builder) =>
    builder.readStorageEntries("OcifStaking", "RegisteredCore", []),
  );

  return (
    <section
      className={css({
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(24rem, 100%), 1fr))",
        gap: "1rem",
      })}
    >
      {ocifCores.map(({ keyArgs: [id], value: core }) => (
        <article
          key={id}
          className={css({
            display: "flex",
            flexDirection: "column",
            borderRadius: "1rem",
            backgroundColor: "surfaceContainer",
            padding: "1rem",
          })}
        >
          <div
            className={css({
              display: "flex",
              flexDirection: "row-reverse",
              justifyContent: "start",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
            })}
          >
            <header>
              <h3
                className={css({ textStyle: "bodyLarge", fontWeight: "bold" })}
              >
                {core.metadata.name.asText()}
              </h3>
              <p>
                Members:{" "}
                {
                  <Suspense fallback="...">
                    <SuspendableCoreMemberCount coreId={id} />
                  </Suspense>
                }
              </p>
            </header>
            <Avatar
              src={core.metadata.image.asText()}
              alt={core.metadata.name.asText()}
            />
          </div>
          <p>{core.metadata.description.asText()}</p>
          <Suspense>
            <SuspendableCoreInfo
              coreId={id}
              className={css({ marginTop: "auto", paddingTop: "1rem" })}
            />
          </Suspense>
        </article>
      ))}
    </section>
  );
}

type CoreMemberCountProps = {
  coreId: number;
};

function SuspendableCoreMemberCount({ coreId }: CoreMemberCountProps) {
  const members = useLazyLoadQuery((builder) =>
    builder.readStorageEntries("INV4", "CoreMembers", [coreId]),
  );
  return members.length;
}

type CoreInfoProps = {
  coreId: number;
  className?: string;
};

function SuspendableCoreInfo({ coreId, className }: CoreInfoProps) {
  const currentEra = useLazyLoadQuery((builder) =>
    builder.readStorage("OcifStaking", "CurrentEra", []),
  );

  const stake = useLazyLoadQuery((builder) =>
    builder.readStorage("OcifStaking", "CoreEraStake", [coreId, currentEra]),
  );

  const nativeToken = useNativeTokenAmountFromPlanck();

  if (stake === undefined) {
    return null;
  }

  return (
    <dl
      className={cx(
        css({
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          "& dd": { justifySelf: "end" },
        }),
        className,
      )}
    >
      <dt>Status</dt>
      <dd>{stake.active ? "active" : "inactive"}</dd>
      <dt>Number of stakers</dt>
      <dd>{stake.number_of_stakers}</dd>
      <dt>Total staked</dt>
      <dd>{nativeToken(stake.total).toLocaleString()}</dd>
    </dl>
  );
}
