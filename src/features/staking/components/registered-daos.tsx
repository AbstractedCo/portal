import { css, cx } from "../../../../styled-system/css";
import { AlertDialog } from "../../../components/alert-dialog";
import { Avatar } from "../../../components/avatar";
import { TextInput } from "../../../components/text-input";
import { selectedAccountAtom } from "../../accounts/store";
import {
  useLazyLoadQuery,
  useNativeTokenAmountFromPlanck,
} from "@reactive-dot/react";
import { BigIntMath } from "@reactive-dot/utils";
import request, { gql } from "graphql-request";
import { useAtomValue } from "jotai";
import { Suspense, useMemo, useState } from "react";
import { use } from "react18-use";

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
                <DaoDescription
                  description={core.metadata.description.asText()}
                />
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

type DaoDescriptionProps = { description: string };

function DaoDescription({ description }: DaoDescriptionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setDialogOpen(true)}
        className={css({
          display: "contents",
          textAlign: "start",
          cursor: "pointer",
        })}
      >
        <p
          className={css({
            height: "7rem",
            border: "1px solid {colors.outlineVariant}",
            borderRadius: "0.6rem",
            padding: "1rem 1.25rem",
            overflow: "hidden",
          })}
        >
          {description}
        </p>
      </button>
      {dialogOpen && (
        <AlertDialog
          title="Project description"
          onClose={() => setDialogOpen(false)}
        >
          {description}
        </AlertDialog>
      )}
    </div>
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
  const account = useAtomValue(selectedAccountAtom);

  const currentEra = useLazyLoadQuery((builder) =>
    builder.readStorage("OcifStaking", "CurrentEra", []),
  );

  const stake = useLazyLoadQuery((builder) =>
    builder.readStorage("OcifStaking", "CoreEraStake", [coreId, currentEra]),
  );

  const nativeToken = useNativeTokenAmountFromPlanck();

  const indexerResponsePromise = useMemo(
    () =>
      request<{
        coreById:
          | { totalRewards: string; totalUnclaimed: string }
          | null
          | undefined;
      }>(
        "https://squid.subsquid.io/ocif-squid-invarch/graphql",
        gql`
          query ($coreId: String!) {
            coreById(id: $coreId) {
              totalRewards
              totalUnclaimed
            }
          }
        `,
        { coreId: String(coreId) },
      ),
    [coreId],
  );

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
      <dd>
        {nativeToken(stake.total).toLocaleString(undefined, {
          notation: "compact",
        })}
      </dd>

      {account !== undefined && <MyStake />}

      <ClaimedRewards />
      <UnclaimedRewards />
      <SupportShare />
      <SupportThreshold />
    </dl>
  );

  function MyStake() {
    return (
      <>
        <dt>My stake</dt>
        <dd>
          <Suspense fallback="...">
            <SuspendableMyStake />
          </Suspense>
        </dd>
      </>
    );

    function SuspendableMyStake() {
      const stakerInfo = useLazyLoadQuery((builder) =>
        builder.readStorage("OcifStaking", "GeneralStakerInfo", [
          coreId,
          account!.address,
        ]),
      );

      return useNativeTokenAmountFromPlanck(
        stakerInfo.reduce((prev, curr) => prev + curr.staked, 0n),
      ).toLocaleString(undefined, {
        notation: "compact",
      });
    }
  }

  function ClaimedRewards() {
    return (
      <>
        <dt>Claimed rewards</dt>
        <dd>
          <Suspense fallback="...">
            <SuspendableClaimedRewards />
          </Suspense>
        </dd>
      </>
    );

    function SuspendableClaimedRewards() {
      const response = use(indexerResponsePromise) as Awaited<
        typeof indexerResponsePromise
      >;

      return useNativeTokenAmountFromPlanck(
        BigInt(response.coreById?.totalRewards ?? 0n),
      ).toLocaleString(undefined, {
        notation: "compact",
      });
    }
  }

  function UnclaimedRewards() {
    return (
      <>
        <dt>Unclaimed rewards</dt>
        <dd>
          <Suspense fallback="...">
            <SuspendableUnclaimedRewards />
          </Suspense>
        </dd>
      </>
    );

    function SuspendableUnclaimedRewards() {
      const response = use(indexerResponsePromise) as Awaited<
        typeof indexerResponsePromise
      >;

      return useNativeTokenAmountFromPlanck(
        response.coreById?.totalUnclaimed ?? 0n,
      ).toLocaleString(undefined, {
        notation: "compact",
      });
    }
  }

  function SupportShare() {
    return (
      <>
        <dt>Support share</dt>
        <dd>
          <Suspense fallback="...">
            <SuspendableSupportShare />
          </Suspense>
        </dd>
      </>
    );

    function SuspendableSupportShare() {
      const currentEra = useLazyLoadQuery((builder) =>
        builder.readStorage("OcifStaking", "CurrentEra", []),
      );

      const [eraInfo, coreStake] = useLazyLoadQuery((builder) =>
        builder
          .readStorage("OcifStaking", "GeneralEraInfo", [currentEra])
          .readStorage("OcifStaking", "CoreEraStake", [coreId, currentEra]),
      );

      const getNativeTokenAmount = useNativeTokenAmountFromPlanck();

      return (
        eraInfo === undefined || coreStake === undefined
          ? 0
          : getNativeTokenAmount(coreStake.total).valueOf() /
            getNativeTokenAmount(eraInfo.staked).valueOf()
      ).toLocaleString(undefined, {
        style: "percent",
        maximumFractionDigits: 2,
      });
    }
  }

  function SupportThreshold() {
    return (
      <>
        <dt>Min. support met</dt>
        <dd>
          <Suspense fallback="...">
            <SuspendableSupportThreshold />
          </Suspense>
        </dd>
      </>
    );

    function SuspendableSupportThreshold() {
      const [_activeThreshold, currentEra] = useLazyLoadQuery((builder) =>
        builder
          .getConstant("OcifStaking", "StakeThresholdForActiveCore")
          .readStorage("OcifStaking", "CurrentEra", []),
      );

      const coreStake = useLazyLoadQuery((builder) =>
        builder.readStorage("OcifStaking", "CoreEraStake", [
          coreId,
          currentEra,
        ]),
      );

      const coreTotalStake = useNativeTokenAmountFromPlanck(
        coreStake?.total ?? 0n,
      );

      const activeThreshold = useNativeTokenAmountFromPlanck(_activeThreshold);

      return (
        <span
          className={css({
            color:
              coreTotalStake.planck >= activeThreshold.planck
                ? "success"
                : "error",
          })}
        >
          {coreTotalStake
            .mapFromPlanck((total) =>
              BigIntMath.min(total, activeThreshold.planck),
            )
            .toLocaleString(undefined, {
              style: "decimal",
              notation: "compact",
            })}
          /
          {activeThreshold.toLocaleString(undefined, {
            style: "decimal",
            notation: "compact",
          })}{" "}
          {coreTotalStake.denomination}
        </span>
      );
    }
  }
}
