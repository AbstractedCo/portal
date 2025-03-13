import { css } from "../../../styled-system/css";
import { CircularProgressIndicator } from "../../components/circular-progress-indicator";
import { Select } from "../../components/select";
import { Tabs } from "../../components/tabs";
import {
  useAccountBalance,
  useDaoBalance,
} from "../../features/accounts/store";
import { selectedAccountAtom } from "../../features/accounts/store";
import { useLazyLoadSelectedDaoId } from "../../features/daos/store";
import { useTokenPrices, useTotalValue } from "../../features/prices/store";
import { useAccounts, useLazyLoadQuery } from "@reactive-dot/react";
import { DenominatedNumber } from "@reactive-dot/utils";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { ConnectionButton } from "dot-connect/react.js";
import { PolkadotIdenticon } from "dot-identicon/react.js";
import { useAtom, useAtomValue } from "jotai";
import { Suspense, useEffect } from "react";

const DECIMALS = 12;

export const Route = createFileRoute("/daos/_layout")({
  component: Layout,
});

function Layout() {
  const location = useLocation();

  // Initialize price fetching at the top level
  // This uses the singleton pattern to ensure only one price fetcher runs
  // and follows the 10-minute cache rules defined in store
  const { isLoading: pricesLoading, error: pricesError } = useTokenPrices();

  // Log any price fetching errors but don't spam the console
  useEffect(() => {
    if (pricesError) {
      console.warn("Price fetching error:", pricesError);
    }
  }, [pricesError]);

  // Custom AccountSelect implementation for the sidebar
  function CustomAccountSelect() {
    const accounts = useAccounts();
    const [selectedAccount, setSelectedAccount] = useAtom(selectedAccountAtom);

    return (
      <Suspense fallback={<CircularProgressIndicator />}>
        <Select
          value={selectedAccount?.address}
          onChangeValue={(address) => {
            const account = accounts.find((acc) => acc.address === address);
            if (account) {
              setSelectedAccount(account);
            }
          }}
          options={accounts.map((account) => ({
            value: account.address,
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

  const formatUSD = (value: number) => {
    if (!value && value !== 0) return "--";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Create asset components to use in both mobile and desktop layouts
  const PersonalAssetsComponent = () => {
    const selectedAccount = useAtomValue(selectedAccountAtom);
    const accountAddress = selectedAccount?.address || "";
    const personalBalance = useAccountBalance();

    // Always call hooks unconditionally, but handle missing data inside
    const personalTokensResult = useLazyLoadQuery((builder) => {
      if (!selectedAccount?.address) return null;
      return builder.readStorageEntries("Tokens", "Accounts", [accountAddress]);
    });

    // Safely handle the result
    const personalTokens = personalTokensResult
      ? Array.isArray(personalTokensResult)
        ? personalTokensResult
        : []
      : [];

    const assetMetadataResult = useLazyLoadQuery((builder) => {
      if (!personalTokens || personalTokens.length === 0) return null;

      return builder.readStorages(
        "AssetRegistry",
        "Metadata",
        personalTokens.map((token) => [token.keyArgs[1]] as const),
      );
    });

    // Safely handle the result
    const assetMetadata = assetMetadataResult
      ? Array.isArray(assetMetadataResult)
        ? assetMetadataResult
        : []
      : [];

    // Create a function to prepare tokens array consistently
    const prepareTokens = () => {
      const result = [];

      // Add other tokens if available
      personalTokens
        .filter((token) => token && token.keyArgs && token.keyArgs[1] !== 0)
        .forEach((token, index) => {
          if (index < assetMetadata.length) {
            const metadata = assetMetadata[index];
            if (metadata) {
              result.push({
                id: token.keyArgs[1],
                value: token.value,
                metadata: {
                  symbol: metadata.symbol?.asText() ?? "UNKNOWN",
                  decimals: metadata.decimals ?? DECIMALS,
                },
              });
            }
          }
        });

      // Add native token if available
      if (personalBalance) {
        result.push({
          id: 0,
          value: {
            free: personalBalance.free,
            reserved: personalBalance.reserved,
            frozen: personalBalance.frozen,
          },
          metadata: {
            symbol: "VARCH",
            decimals: DECIMALS,
          },
        });
      }

      return result;
    };

    // Calculate total value using the price store
    // This will use the cached prices that refresh every 10 minutes
    const tokens = prepareTokens();
    const { total: totalValue, isLoading: valuationLoading } =
      useTotalValue(tokens);

    const isLoading = !personalTokens || !personalBalance;

    // Show loading state or no account selected state
    if (!selectedAccount) {
      return (
        <article
          className={css({
            backgroundColor: "surfaceContainer",
            borderRadius: "1rem",
            padding: "2rem",
          })}
        >
          <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>
            Personal Assets
          </header>
          <div className={css({ color: "content.muted" })}>
            Please select an account to view assets
          </div>
        </article>
      );
    }

    if (isLoading) {
      return (
        <article
          className={css({
            backgroundColor: "surfaceContainer",
            borderRadius: "1rem",
            padding: "2rem",
          })}
        >
          <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>
            Personal Assets
          </header>
          <CircularProgressIndicator />
        </article>
      );
    }

    const safeBalance = {
      free: personalBalance?.free || BigInt(0),
      reserved: personalBalance?.reserved || BigInt(0),
      frozen: personalBalance?.frozen || BigInt(0),
    };

    return (
      <article
        className={css({
          backgroundColor: "surfaceContainer",
          borderRadius: "1rem",
          padding: "2rem",
        })}
      >
        <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>
          Personal Assets
        </header>
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
          <dd>{formatDenominated(safeBalance.free)}</dd>
          <dt>Total Portfolio Value</dt>
          <dd>
            {pricesLoading || valuationLoading ? "--" : formatUSD(totalValue)}
          </dd>
        </dl>
      </article>
    );
  };

  const DaoAssetsComponent = () => {
    const daoId = useLazyLoadSelectedDaoId();
    const daoBalance = useDaoBalance();

    // Get the DAO storage without throwing errors when no ID exists
    const coreStorage = useLazyLoadQuery((builder) => {
      if (!daoId) return null;
      return builder.readStorage("INV4", "CoreStorage", [daoId]);
    });

    // Safely handle the coreStorage result
    const account =
      coreStorage && typeof coreStorage === "object" && "account" in coreStorage
        ? coreStorage.account
        : "";

    // Always call hooks unconditionally but handle missing data inside
    const daoTokensResult = useLazyLoadQuery((builder) => {
      if (!account) return null;
      return builder.readStorageEntries("Tokens", "Accounts", [account]);
    });

    // Safely handle the result
    const daoTokens = daoTokensResult
      ? Array.isArray(daoTokensResult)
        ? daoTokensResult
        : []
      : [];

    const assetMetadataResult = useLazyLoadQuery((builder) => {
      if (!daoTokens || daoTokens.length === 0) return null;

      return builder.readStorages(
        "AssetRegistry",
        "Metadata",
        daoTokens.map((token) => [token.keyArgs[1]] as const),
      );
    });

    // Safely handle the result
    const assetMetadata = assetMetadataResult
      ? Array.isArray(assetMetadataResult)
        ? assetMetadataResult
        : []
      : [];

    // Create a function to prepare tokens array consistently
    const prepareTokens = () => {
      const result = [];

      // Add other tokens if available
      daoTokens
        .filter((token) => token && token.keyArgs && token.keyArgs[1] !== 0)
        .forEach((token, index) => {
          if (index < assetMetadata.length) {
            const metadata = assetMetadata[index];
            if (metadata) {
              result.push({
                id: token.keyArgs[1],
                value: token.value,
                metadata: {
                  symbol: metadata.symbol?.asText() ?? "UNKNOWN",
                  decimals: metadata.decimals ?? DECIMALS,
                },
              });
            }
          }
        });

      // Add native token if available
      if (daoBalance) {
        result.push({
          id: 0,
          value: {
            free: daoBalance.free,
            reserved: daoBalance.reserved,
            frozen: daoBalance.frozen,
          },
          metadata: {
            symbol: "VARCH",
            decimals: DECIMALS,
          },
        });
      }

      return result;
    };

    // Calculate total value using the price store
    // This will use the cached prices that refresh every 10 minutes
    const tokens = prepareTokens();
    const { total: totalValue, isLoading: valuationLoading } =
      useTotalValue(tokens);

    const isLoading = !daoTokens || !daoBalance;

    // Show loading state or no DAO selected state
    if (!daoId) {
      return (
        <article
          className={css({
            backgroundColor: "surfaceContainer",
            borderRadius: "1rem",
            padding: "2rem",
          })}
        >
          <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>
            DAO Assets
          </header>
          <div className={css({ color: "content.muted" })}>
            Please select a DAO to view assets
          </div>
        </article>
      );
    }

    if (isLoading) {
      return (
        <article
          className={css({
            backgroundColor: "surfaceContainer",
            borderRadius: "1rem",
            padding: "2rem",
          })}
        >
          <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>
            DAO Assets
          </header>
          <CircularProgressIndicator />
        </article>
      );
    }

    const safeBalance = {
      free: daoBalance?.free || BigInt(0),
      reserved: daoBalance?.reserved || BigInt(0),
      frozen: daoBalance?.frozen || BigInt(0),
    };

    return (
      <article
        className={css({
          backgroundColor: "surfaceContainer",
          borderRadius: "1rem",
          padding: "2rem",
        })}
      >
        <header className={css({ fontWeight: "bold", marginBottom: "1rem" })}>
          DAO Assets
        </header>
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
          <dd>{formatDenominated(safeBalance.free)}</dd>
          <dt>Total Portfolio Value</dt>
          <dd>
            {pricesLoading || valuationLoading ? "--" : formatUSD(totalValue)}
          </dd>
        </dl>
      </article>
    );
  };

  // Account selector container for desktop sidebar
  const AccountSelectorComponent = () => (
    <div
      className={css({
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
          },
        },
      })}
    >
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
