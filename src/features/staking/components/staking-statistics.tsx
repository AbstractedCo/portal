import { css, cx } from "../../../../styled-system/css";
import {
  CoinsWithCalendarIcon,
  CoinsWithCheckmarkIcon,
} from "../../../icons/coins";
import { CrosshairsIcon } from "../../../icons/crosshairs";
import { HourglassIcon, HourglassWithLockIcon } from "../../../icons/hourglass";
import { TachometerFastIcon } from "../../../icons/tachometer";
import { VaultIcon } from "../../../icons/vault";
import { selectedAccountAtom } from "../../accounts/store";
import {
  useLazyLoadQuery,
  useNativeTokenAmountFromNumber,
  useNativeTokenAmountFromPlanck,
} from "@reactive-dot/react";
import request, { gql } from "graphql-request";
import { useAtomValue } from "jotai";
import { type ReactNode, Suspense, useMemo } from "react";
import { use } from "react18-use";

type StakingStatisticsProps = {
  className?: string;
};

export function StakingStatistics({ className }: StakingStatisticsProps) {
  return (
    <section
      className={cx(
        css({
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          "&>*": { flex: "12rem 1" },
        }),
        className,
      )}
    >
      <MyStake />
      <UnclaimedEras />
      <ClaimableRewards />
      <Apy />
      <AnnualReward />
      <CurrentEra />
      <Completion />
    </section>
  );
}

function MyStake() {
  const account = useAtomValue(selectedAccountAtom);

  if (account === undefined) {
    return null;
  }

  return (
    <StatCard
      icon={<CrosshairsIcon />}
      label="My stake"
      value={
        <Suspense fallback="...">
          <SuspendableMyStake />
        </Suspense>
      }
    />
  );

  function SuspendableMyStake() {
    return useNativeTokenAmountFromPlanck(
      useLazyLoadQuery((builder) =>
        builder.readStorage("OcifStaking", "Ledger", [account!.address]),
      ).locked,
    ).toLocaleString();
  }
}

function UnclaimedEras() {
  const account = useAtomValue(selectedAccountAtom);

  if (account === undefined) {
    return null;
  }

  return (
    <StatCard
      icon={<HourglassWithLockIcon />}
      label="Unclaimed eras"
      value={
        <Suspense fallback="...">
          <SuspendableUnclaimedEras />
        </Suspense>
      }
    />
  );

  function SuspendableUnclaimedEras() {
    const [currentEra, registeredCores] = useLazyLoadQuery((builder) =>
      builder
        .readStorage("OcifStaking", "CurrentEra", [])
        .readStorageEntries("OcifStaking", "RegisteredCore", []),
    );

    const generalStakerInfo = useLazyLoadQuery((builder) =>
      builder.readStorages(
        "OcifStaking",
        "GeneralStakerInfo",
        registeredCores.map(
          ({ keyArgs: [coreKey] }) => [coreKey, account!.address] as const,
        ),
      ),
    );

    const minEra = Math.min(
      ...generalStakerInfo.flat().map((info) => info.era),
    );

    return (Number.isFinite(minEra) ? currentEra - minEra : 0).toLocaleString();
  }
}

function ClaimableRewards() {
  const account = useAtomValue(selectedAccountAtom);

  const responsePromise = useMemo(
    () =>
      account === undefined
        ? undefined
        : request<{
            stakerById: { totalUnclaimed: string } | null | undefined;
          }>(
            "https://squid.subsquid.io/ocif-squid-invarch/graphql",
            gql`
              query ($address: String!) {
                stakerById(id: $address) {
                  totalUnclaimed
                }
              }
            `,
            { address: account.address },
          ),
    [account],
  );

  if (account === undefined) {
    return null;
  }

  return (
    <StatCard
      icon={<CoinsWithCheckmarkIcon />}
      label="Claimable rewards"
      value={
        <Suspense fallback="...">
          <SuspendableClaimableRewards />
        </Suspense>
      }
    />
  );

  function SuspendableClaimableRewards() {
    const response = use(responsePromise!) as Awaited<
      NonNullable<typeof responsePromise>
    >;

    const fromPlanck = useNativeTokenAmountFromPlanck();
    const fromNumber = useNativeTokenAmountFromNumber();

    return (
      response.stakerById
        ? fromPlanck(response.stakerById.totalUnclaimed)
        : fromNumber(0)
    ).toLocaleString();
  }
}

function Apy() {
  return (
    <StatCard
      icon={<VaultIcon />}
      label="Staking APY"
      value={
        <Suspense fallback="...">
          <SuspendableApy />
        </Suspense>
      }
    />
  );

  function SuspendableApy() {
    const currentEra = useLazyLoadQuery((builder) =>
      builder.readStorage("OcifStaking", "CurrentEra", []),
    );

    const [_totalIssuance, eraInfo] = useLazyLoadQuery((builder) =>
      builder
        .readStorage("Balances", "TotalIssuance", [])
        .readStorage("OcifStaking", "GeneralEraInfo", [currentEra]),
    );

    const totalIssuance = useNativeTokenAmountFromPlanck(_totalIssuance);
    const totalStaked = useNativeTokenAmountFromPlanck(eraInfo?.staked ?? 0n);

    const apy =
      totalStaked.planck === 0n || totalStaked.planck === 0n
        ? 0
        : (totalIssuance.valueOf() * 4) / totalStaked.valueOf() / 100;

    return apy.toLocaleString(undefined, {
      style: "percent",
      maximumFractionDigits: 2,
    });
  }
}

function AnnualReward() {
  return (
    <StatCard
      icon={<CoinsWithCalendarIcon />}
      label="Annual rewards"
      value={
        <Suspense fallback="...">
          <SuspendableAnnualReward />
        </Suspense>
      }
    />
  );

  function SuspendableAnnualReward() {
    const [[coreRewards], _totalIssuance] = useLazyLoadQuery((builder) =>
      builder
        .getConstant("OcifStaking", "RewardRatio")
        .readStorage("Balances", "TotalIssuance", []),
    );

    const totalIssuance = useNativeTokenAmountFromPlanck(_totalIssuance);

    return totalIssuance
      .mapFromNumber(
        (number) =>
          number * 0.1 * (coreRewards === undefined ? 0 : coreRewards / 100),
      )
      .toLocaleString();
  }
}

function CurrentEra() {
  return (
    <StatCard
      icon={<HourglassIcon />}
      label="Current Era"
      value={
        <Suspense fallback="...">
          <SuspendableCurrentEra />
        </Suspense>
      }
    />
  );

  function SuspendableCurrentEra() {
    return useLazyLoadQuery((builder) =>
      builder.readStorage("OcifStaking", "CurrentEra", []),
    ).toLocaleString();
  }
}

function Completion() {
  return (
    <StatCard
      icon={<TachometerFastIcon />}
      label="Completion"
      value={
        <Suspense fallback="...">
          <SuspendableCompletion />
        </Suspense>
      }
    />
  );

  function SuspendableCompletion() {
    const [blocksPerEra, currentBlock, nextEraBlock] = useLazyLoadQuery(
      (builder) =>
        builder
          .getConstant("OcifStaking", "BlocksPerEra")
          .readStorage("System", "Number", [])
          .readStorage("OcifStaking", "NextEraStartingBlock", []),
    );

    return ((nextEraBlock - currentBlock) / blocksPerEra).toLocaleString(
      undefined,
      { style: "percent" },
    );
  }
}

type StatCardProps = {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <article
      className={css({
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        borderRadius: "1rem",
        backgroundColor: "surfaceContainer",
        padding: "2rem",
      })}
    >
      <figure className={css({ display: "contents" })}>
        <div
          className={css({
            order: 0,
            display: "flex",
            width: "3rem",
            height: "3rem",
            borderRadius: "1.5rem",
            backgroundColor: "surface",
          })}
        >
          <div className={css({ margin: "auto" })}>{icon}</div>
        </div>
        <figcaption
          className={css({
            order: 2,
            textStyle: "body",
            color: "content.muted",
          })}
        >
          {label}
        </figcaption>
      </figure>
      <div
        className={css({
          order: 1,
          textStyle: "bodyLarge",
          fontWeight: "bold",
        })}
      >
        {value}
      </div>
    </article>
  );
}
