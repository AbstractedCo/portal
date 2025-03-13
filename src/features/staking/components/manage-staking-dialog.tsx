import { css } from "../../../../styled-system/css";
import { AlertDialog } from "../../../components/alert-dialog";
import { Button } from "../../../components/button";
import { CircularProgressIndicator } from "../../../components/circular-progress-indicator";
import { Select } from "../../../components/select";
import { Tabs } from "../../../components/tabs";
import { TextInput } from "../../../components/text-input";
import { SuspendableAccountTotalStake } from "./account-stake";
import { pending } from "@reactive-dot/core";
import type { WalletAccount } from "@reactive-dot/core/wallets.js";
import {
  useLazyLoadQuery,
  useMutation,
  useNativeTokenAmountFromNumber,
  useNativeTokenAmountFromPlanck,
  useSpendableBalance,
} from "@reactive-dot/react";
import { Suspense, useMemo, useState } from "react";

export type ManageStakingDialogProps = {
  daoId: number;
  account: WalletAccount;
  onClose: () => void;
};

export function ManageStakingDialog({
  daoId,
  account,
  onClose,
}: ManageStakingDialogProps) {
  const [tab, setTab] = useState<"stake" | "unstake">("stake");

  return (
    <AlertDialog
      title={
        <>
          Manage staking
          <Suspense>
            <SuspendableTitle />
          </Suspense>
        </>
      }
      onClose={onClose}
      className={css({
        containerType: "inline-size",
        width: `min(34rem, 100dvw)`,
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        })}
      >
        <div
          className={css({
            textStyle: "body",
            display: "flex",
            gap: "1rem 3rem",
            flexWrap: "wrap",
            "&>article": {
              display: "flex",
              flexDirection: "column-reverse",
              "& header": { textStyle: "bodySmall", color: "content.muted" },
            },
          })}
        >
          <article>
            <header>Available balance</header>
            <Suspense fallback={<CircularProgressIndicator size="1lh" />}>
              <SuspendableAvailableBalance />
            </Suspense>
          </article>
          <article>
            <header>Currently staked</header>
            <Suspense fallback={<CircularProgressIndicator size="1lh" />}>
              <SuspendableAccountTotalStake daoId={daoId} account={account!} />
            </Suspense>
          </article>
        </div>
        <Suspense>
          <SuspendableTabs />
        </Suspense>
        <Suspense fallback={<CircularProgressIndicator />}>
          {(() => {
            switch (tab) {
              case "stake":
                return <SuspendableStake />;
              case "unstake":
                return <SuspendableUnstake />;
            }
          })()}
        </Suspense>
      </div>
    </AlertDialog>
  );

  function SuspendableTabs() {
    const staked = useNativeTokenAmountFromPlanck(
      useLazyLoadQuery((builder) =>
        builder.readStorage("OcifStaking", "GeneralStakerInfo", [
          daoId,
          account.address,
        ]),
      ).at(-1)?.staked ?? 0n,
    );

    if (staked.planck <= 0n) {
      return null;
    }

    return (
      <Tabs value={tab} onChangeValue={setTab}>
        <Tabs.Item value="stake" className={css({ whiteSpace: "nowrap" })}>
          Stake / Restake
        </Tabs.Item>
        <Tabs.Item value="unstake">Unstake</Tabs.Item>
      </Tabs>
    );
  }

  function SuspendableTitle() {
    const core = useLazyLoadQuery((builder) =>
      builder.readStorage("OcifStaking", "RegisteredCore", [daoId]),
    );

    if (core === undefined) {
      return null;
    }

    return <> for {core.metadata.name.asText()}</>;
  }

  function SuspendableAvailableBalance() {
    return useSpendableBalance(account.address).toLocaleString();
  }

  function SuspendableStake() {
    const registeredCores = useLazyLoadQuery((builder) =>
      builder.readStorageEntries("OcifStaking", "RegisteredCore", []),
    );

    const stakerInfos = useLazyLoadQuery((builder) =>
      builder.readStorages(
        "OcifStaking",
        "GeneralStakerInfo",
        registeredCores.map(
          ({ keyArgs: [daoId] }) => [daoId, account.address] as const,
        ),
      ),
    );

    const coreStakes = useMemo(
      () =>
        stakerInfos.map((info, index) => ({
          core: {
            id: registeredCores.at(index)!.keyArgs[0],
            name: registeredCores.at(index)!.value.metadata.name.asText(),
          },
          staked: info.at(-1)?.staked ?? 0n,
        })),
      [registeredCores, stakerInfos],
    );

    const spendableBalance = useSpendableBalance(account.address);

    const [sourceBalance, setSourceBalance] = useState<"available" | number>(
      "available",
    );

    const nativeTokenAmountFromPlanck = useNativeTokenAmountFromPlanck();

    const availableToStake =
      sourceBalance === "available"
        ? spendableBalance
        : nativeTokenAmountFromPlanck(
            coreStakes.find((stake) => stake.core.id === sourceBalance)!.staked,
          );

    const [amount, setAmount] = useState("");

    const numberAmount =
      amount.trim() === "" || Number.isNaN(Number(amount)) ? undefined : amount;

    const nativeTokenAmountFromNumber = useNativeTokenAmountFromNumber();
    const nativeTokenAmount =
      numberAmount === undefined
        ? undefined
        : nativeTokenAmountFromNumber(numberAmount);

    const [stakeState, stake] = useMutation((builder) =>
      sourceBalance === "available"
        ? builder.OcifStaking.stake({
            dao_id: daoId,
            value: nativeTokenAmount?.planck ?? 0n,
          })
        : builder.OcifStaking.move_stake({
            from_dao: sourceBalance,
            to_dao: daoId,
            amount: nativeTokenAmount?.planck ?? 0n,
          }),
    );

    const error = useMemo(() => {
      if (
        nativeTokenAmount !== undefined &&
        nativeTokenAmount.planck > availableToStake.planck
      ) {
        return "Insufficient balance";
      }

      return;
    }, [availableToStake, nativeTokenAmount]);

    const ready = error === undefined && nativeTokenAmount !== undefined;

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          stake();
        }}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            "@container(min-width: 26rem)": {
              flexDirection: "row",
            },
          })}
        >
          <Select
            label="Transfer funds from"
            options={[
              { value: "available", label: "Available balance" },
              ...coreStakes.map((stake) => ({
                value: stake.core.id,
                label: stake.core.name,
              })),
            ]}
            value={sourceBalance}
            onChangeValue={setSourceBalance}
            className={css({ width: "stretch!" })}
          />
          <TextInput
            label="Stake amount"
            value={amount}
            onChangeValue={setAmount}
            trailingLabel={<>Available: {availableToStake.toLocaleString()}</>}
            supporting={error}
            className={css({ width: "stretch!" })}
          />
        </div>
        <Button
          type="submit"
          disabled={!ready}
          pending={stakeState === pending}
          className={css({ marginTop: "2.5rem", width: "stretch" })}
        >
          {sourceBalance === "available" ? "Stake" : "Restake"}
        </Button>
      </form>
    );
  }

  function SuspendableUnstake() {
    const staked = useNativeTokenAmountFromPlanck(
      useLazyLoadQuery((builder) =>
        builder.readStorage("OcifStaking", "GeneralStakerInfo", [
          daoId,
          account.address,
        ]),
      ).at(-1)?.staked ?? 0n,
    );

    const [amount, setAmount] = useState("");

    const numberAmount =
      amount.trim() === "" || Number.isNaN(Number(amount)) ? undefined : amount;

    const fromNativeTokenAmount = useNativeTokenAmountFromNumber();
    const nativeTokenAmount =
      numberAmount === undefined
        ? undefined
        : fromNativeTokenAmount(numberAmount);

    const [unstakeState, unstake] = useMutation((builder) =>
      builder.OcifStaking.unstake({
        dao_id: daoId,
        value: nativeTokenAmount?.planck ?? 0n,
      }),
    );

    const error = useMemo(() => {
      if (
        nativeTokenAmount !== undefined &&
        nativeTokenAmount.planck > staked.planck
      ) {
        return "Insufficient balance";
      }

      return;
    }, [nativeTokenAmount, staked.planck]);

    const ready = error === undefined && nativeTokenAmount !== undefined;

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          unstake();
        }}
      >
        <TextInput
          label="Unstake amount"
          trailingLabel={<>Available: {staked.toLocaleString()}</>}
          value={amount}
          onChangeValue={setAmount}
          supporting={error}
          className={css({ width: "stretch!" })}
        />
        <Button
          type="submit"
          disabled={!ready}
          pending={unstakeState === pending}
          className={css({ marginTop: "2.5rem", width: "stretch" })}
        >
          Unstake
        </Button>
      </form>
    );
  }
}
