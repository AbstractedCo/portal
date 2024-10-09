import { css, cx } from "../../../../styled-system/css";
import { Avatar } from "../../../components/avatar";
import { TextInput } from "../../../components/text-input";
import {
  useLazyLoadQuery,
  useNativeTokenAmountFromPlanck,
} from "@reactive-dot/react";
import { Suspense, useState } from "react";

export function RegisteredDaos() {
  return (
    <Suspense fallback="...">
      <SuspendableRegisteredDaos />
    </Suspense>
  );
}

export function SuspendableRegisteredDaos() {
  const ocifCores = useLazyLoadQuery((builder) =>
    builder.readStorageEntries("OcifStaking", "RegisteredCore", []),
  );

  const [_search, setSearch] = useState("");
  const search = _search.trim();

  return (
    <section>
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "3rem",
        })}
      >
        <header>List of projects</header>
        <TextInput
          value={search}
          onChangeValue={setSearch}
          placeholder="Search"
        />
      </div>
      <div
        className={css({
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(24rem, 100%), 1fr))",
          gap: "1.5rem",
        })}
      >
        {ocifCores
          .filter(
            ({ value: core }) =>
              search === "" ||
              core.metadata.name
                .asText()
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map(({ keyArgs: [id], value: core }) => (
            <article
              key={id}
              className={css({
                display: "flex",
                flexDirection: "column",
                borderRadius: "1rem",
                backgroundColor: "surfaceContainer",
                padding: "2rem",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  flexDirection: "row-reverse",
                  justifyContent: "start",
                  alignItems: "center",
                  gap: "1.25rem",
                  marginBottom: "2rem",
                })}
              >
                <header>
                  <h3
                    className={css({
                      textStyle: "bodyLarge",
                      fontWeight: "bold",
                    })}
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
              <label>
                <div
                  className={css({
                    textStyle: "bodySmall",
                    color: "content.muted",
                    margin: "0 0 0.5rem 1.25rem",
                  })}
                >
                  About the project
                </div>
                <p
                  className={css({
                    height: "7rem",
                    border: "1px solid {colors.outlineVariant}",
                    borderRadius: "0.6rem",
                    padding: "1rem 1.25rem",
                    overflow: "hidden",
                  })}
                >
                  {core.metadata.description.asText()}
                </p>
              </label>
              <Suspense>
                <SuspendableCoreInfo
                  coreId={id}
                  className={css({ marginTop: "auto", paddingTop: "1rem" })}
                />
              </Suspense>
            </article>
          ))}
      </div>
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
      <dt>Total stakers</dt>
      <dd>{stake.number_of_stakers}</dd>
      <dt>Total staked</dt>
      <dd>{nativeToken(stake.total).toLocaleString()}</dd>
    </dl>
  );
}
