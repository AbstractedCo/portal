import { css } from "../../../styled-system/css";
import { Tabs } from "../../components/tabs";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { DenominatedNumber } from "@reactive-dot/utils";
import { useAccountBalance, useDaoBalance } from "../../features/accounts/store";
import { ConnectionButton } from "dot-connect/react.js";
import { Select } from "../../components/select";
import { useAtom } from "jotai";
import { selectedAccountIdAtom } from "../../features/accounts/store";
import { useAccounts } from "@reactive-dot/react";
import { PolkadotIdenticon } from "dot-identicon/react.js";
import { CircularProgressIndicator } from "../../components/circular-progress-indicator";
import { Suspense } from "react";

const DECIMALS = 12;

export const Route = createFileRoute("/daos/_layout")({
  component: Layout,
});

function Layout() {
  const location = useLocation();
  const personalBalance = useAccountBalance();
  const daoBalance = useDaoBalance();

  // Custom AccountSelect implementation for the sidebar
  function CustomAccountSelect() {
    const accounts = useAccounts();
    const [selectedAccount, setSelectedAccount] = useAtom(selectedAccountIdAtom);

    return (
      <Suspense fallback={<CircularProgressIndicator />}>
        <Select
          value={selectedAccount}
          onChangeValue={setSelectedAccount}
          options={accounts.map((account) => ({
            value: account.wallet.id + account.address,
            label: account.name ?? account.address,
            icon: <PolkadotIdenticon address={account.address} />,
          }))}
          placeholder="Please select an account"
        />
      </Suspense>
    );
  }

  const formatDenominated = (balance: bigint) => {
    if (!balance) return "--";
    return new DenominatedNumber(balance, DECIMALS, "VARCH").toLocaleString();
  };

  // Create asset components to use in both mobile and desktop layouts
  const PersonalAssetsComponent = () => (
    <article
      className={css({
        backgroundColor: "surfaceContainer",
        borderRadius: "1rem",
        padding: "2rem",
      })}
    >
      <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>Personal Assets</header>
      <dl
        className={css({
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) max-content",
          "& dt": {
            borderBottom: "0.25px solid {colors.outlineVariant}",
            padding: "1rem 1rem 1rem 0",
            color: "content.muted",
          },
          "& dd": {
            padding: "1rem 0 1rem 1rem",
            borderBottom: "1.5px solid {colors.outline}",
            textAlign: "end",
          },
          "& :is(dd, dt):last-of-type": {
            borderWidth: 0,
            paddingBottom: 0,
          },
        })}
      >
        <dt>Available Balance</dt>
        <dd>{formatDenominated(personalBalance.free)}</dd>
      </dl>
    </article>
  );

  const DaoAssetsComponent = () => (
    <article
      className={css({
        backgroundColor: "surfaceContainer",
        borderRadius: "1rem",
        padding: "2rem",
      })}
    >
      <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>DAO Assets</header>
      <dl
        className={css({
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) max-content",
          "& dt": {
            borderBottom: "0.25px solid {colors.outlineVariant}",
            padding: "1rem 1rem 1rem 0",
            color: "content.muted",
          },
          "& dd": {
            padding: "1rem 0 1rem 1rem",
            borderBottom: "1.5px solid {colors.outline}",
            textAlign: "end",
          },
          "& :is(dd, dt):last-of-type": {
            borderWidth: 0,
            paddingBottom: 0,
          },
        })}
      >
        <dt>Free Native Balance</dt>
        <dd>{formatDenominated(daoBalance.free)}</dd>
      </dl>
    </article>
  );

  // Account selector container for desktop sidebar
  const AccountSelectorComponent = () => (
    <div className={css({
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      justifyContent: "center",
      marginBottom: "0.75rem",
      "--dc-primary-color": "var(--colors-primary)",
      "--dc-on-primary-color": "var(--colors-on-primary)",
      "& > div": {
        flex: 1,
      },
      "& [data-part='trigger']": {
        display: "inline-flex",
        alignItems: "center",
        minHeight: "3.5rem",
        padding: "0.5rem 0.75rem",
        "& > *": {
          display: "flex",
          alignItems: "center",
        }
      }
    })}>
      <CustomAccountSelect />
      <ConnectionButton />
    </div>
  );

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        "@media(min-width: 64rem)": {
          flexDirection: "row-reverse",
        },
      })}
    >
      {/* Sidebar for Desktop only */}
      <div
        className={css({
          display: "none", // Hide on mobile
          "@media(min-width: 64rem)": {
            display: "flex",
            flex: "0 0 20rem",
            flexDirection: "column",
            gap: "1rem",
            position: "sticky",
            top: 0,
            height: "fit-content",
          },
        })}
      >
        <AccountSelectorComponent />
        <PersonalAssetsComponent />
        <DaoAssetsComponent />
      </div>

      {/* Main content */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
          "@media(min-width: 64rem)": {
            flex: 1,
            maxWidth: "calc(100% - 21rem)",
            overflow: "hidden",
          },
        })}
      >
        <Tabs
          value={location.pathname}
          className={css({
            fontSize: "0.85rem",
            width: "100%",
            paddingBottom: "1rem",
            marginBottom: "0.5rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            "& [data-part='trigger']": {
              padding: "1rem 0.5rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "3rem",
              fontWeight: "500",
            },
            "& [data-part='list']": {
              height: "auto",
              minHeight: "3rem",
            },
            "@media(min-width: 64rem)": {
              fontSize: "revert",
              marginBottom: "2.75rem",
              paddingBottom: 0,
              borderBottom: "none",
            },
          })}
        >
          <Link to="/daos/assets" className={css({ display: "contents" })}>
            <Tabs.Item value="/daos/assets">Assets</Tabs.Item>
          </Link>
          <Link
            to="/daos/transactions"
            className={css({ display: "contents" })}
          >
            <Tabs.Item value="/daos/transactions">Transactions</Tabs.Item>
          </Link>
          <Link to="/daos/settings" className={css({ display: "contents" })}>
            <Tabs.Item value="/daos/settings">Settings</Tabs.Item>
          </Link>
          <Link to="/daos/members" className={css({ display: "contents" })}>
            <Tabs.Item value="/daos/members">Members</Tabs.Item>
          </Link>
        </Tabs>
        <Outlet />

        {/* Assets shown below content on mobile only */}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            marginTop: "2rem",
            "@media(min-width: 64rem)": {
              display: "none", // Hide on desktop
            },
          })}
        >
          <PersonalAssetsComponent />
          <DaoAssetsComponent />
        </div>
      </div>
    </div>
  );
}
