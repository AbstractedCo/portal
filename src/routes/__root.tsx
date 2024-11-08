import { css, cx } from "../../styled-system/css";
import { Button } from "../components/button";
import { CircularProgressIndicator } from "../components/circular-progress-indicator";
import { Select } from "../components/select";
import { config } from "../config";
import {
  accountsAtom,
  selectedAccountAtom,
  selectedAccountIdAtom,
} from "../features/accounts/store";
import {
  useLazyLoadSelectedDaoId,
  useSetSelectedDaoId,
} from "../features/daos/store";
import { AccountListItem } from "../widgets/account-list-item";
import { Logo } from "../widgets/logo";
import {
  ChainProvider,
  ReactiveDotProvider,
  SignerProvider,
  useAccounts,
  useConnectedWallets,
  useLazyLoadQuery,
} from "@reactive-dot/react";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { registerDotConnect } from "dot-connect";
import "dot-connect/font.css";
import { ConnectionButton } from "dot-connect/react.js";
import { PolkadotIdenticon } from "dot-identicon/react.js";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Menu, X } from "lucide-react";
import { Suspense, useEffect } from "react";

registerDotConnect({ wallets: config.wallets ?? [] });

export const Route = createRootRouteWithContext<{
  title?: string | undefined;
}>()({
  component: Root,
});

const sideBarOpenAtom = atom(false);

function Root() {
  return (
    <ReactiveDotProvider config={config}>
      <ChainProvider chainId="invarch">
        <SignerProvider
          signer={useAtomValue(selectedAccountAtom)?.polkadotSigner}
        >
          <Suspense fallback={<CircularProgressIndicator />}>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                minHeight: "100dvh",
                "@media(min-width: 48rem)": {
                  height: "100dvh",
                  display: "grid",
                  gridTemplateAreas: `
                  "logo nav"
                  "side top"
                  "side main"
                `,
                  gridTemplateColumns: "max-content 1fr",
                  gridTemplateRows: "min-content min-content 1fr",
                },
              })}
            >
              <Header
                className={css({
                  gridArea: "logo",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                })}
              />
              <Navigation
                className={css({
                  gridArea: "nav",
                  order: 1,
                  position: "sticky",
                  bottom: 0,
                  margin: "2rem 0 0 0",
                  "@media(min-width: 48rem)": {
                    flex: 1,
                    order: "revert",
                    margin: 0,
                  },
                })}
              />
              <TopBar
                className={css({
                  gridArea: "top",
                  padding: "1rem 1rem 0.5rem 1rem",
                })}
              />
              <SideBar
                className={css({
                  gridArea: "side",
                  width: "100dvw",
                  zIndex: 1,
                  "@media(min-width: 48rem)": {
                    width: "16rem",
                  },
                })}
              />
              <div
                className={css({
                  gridArea: "main",
                  flex: 1,
                  padding: "2rem 1rem",
                  "@media(min-width: 48rem)": { overflow: "auto" },
                })}
              >
                <Outlet />
                <AccountsSynchronizer />
              </div>
            </div>
          </Suspense>
        </SignerProvider>
      </ChainProvider>
    </ReactiveDotProvider>
  );
}

type HeaderProps = {
  className?: string | undefined;
};

function Header({ className }: HeaderProps) {
  const setSideBarOpen = useSetAtom(sideBarOpenAtom);
  return (
    <header
      className={cx(
        className,
        css({
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          backgroundColor: "container",
          padding: "1rem",
        }),
      )}
    >
      <button
        onClick={() => setSideBarOpen((open) => !open)}
        className={css({
          cursor: "pointer",
          "@media(min-width: 48rem)": { display: "none" },
        })}
      >
        <Menu />
      </button>
      <Logo />
    </header>
  );
}

type NavigationProps = {
  className?: string | undefined;
};

function Navigation({ className }: NavigationProps) {
  const activeProps = { className: css({ color: "primary" }) };
  return (
    <nav
      className={cx(className, css({ backgroundColor: "surfaceContainer" }))}
    >
      <ul
        className={css({
          textStyle: "bodySmall",
          display: "flex",
          justifyContent: "space-evenly",
          gap: "1rem",
          padding: "1rem",
          "@media(min-width: 48rem)": {
            textStyle: "body",
            justifyContent: "end",
            gap: "2rem",
          },
        })}
      >
        <li>
          <Link to="/daos" activeProps={activeProps}>
            DAOs
          </Link>
        </li>
        <li>
          <Link to="/staking" activeProps={activeProps}>
            Staking
          </Link>
        </li>
        <li>
          <Link to="/governance" activeProps={activeProps}>
            Governance
          </Link>
        </li>
        <li>
          <Link to="/profile" activeProps={activeProps}>
            Profile
          </Link>
        </li>
      </ul>
    </nav>
  );
}

type TopBarProps = { className?: string };

function TopBar({ className }: TopBarProps) {
  const matches = useRouterState({ select: (s) => s.matches });

  const title = matches.at(-1)?.context.title;

  return (
    <header
      className={cx(
        css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }),
        className,
      )}
    >
      <h1 className={css({ textStyle: "bodyLarge", fontWeight: "bold" })}>
        {title}
      </h1>
      <div
        className={css({
          "--dc-primary-color": "var(--colors-primary)",
          "--dc-on-primary-color": "var(--colors-on-primary)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        })}
      >
        <AccountSelect />
        <ConnectionButton />
      </div>
    </header>
  );
}

function AccountSelect() {
  const connectedWallets = useConnectedWallets();

  if (connectedWallets.length === 0) {
    return null;
  }

  return (
    <Suspense fallback={<CircularProgressIndicator />}>
      <SuspendableAccountSelect />
    </Suspense>
  );

  function SuspendableAccountSelect() {
    const accounts = useAccounts();
    const [selectedAccount, setSelectedAccount] = useAtom(
      selectedAccountIdAtom,
    );

    return (
      <Select
        value={selectedAccount}
        onChangeValue={setSelectedAccount}
        options={accounts.map((account) => ({
          value: account.wallet.id + account.address,
          label: account.name ?? account.address,
          icon: <PolkadotIdenticon address={account.address} />,
        }))}
        placeholder="Select an account"
      />
    );
  }
}

type SideBarProps = {
  className?: string | undefined;
};

function SideBar({ className }: SideBarProps) {
  const [sideBarOpen, setSideBarOpen] = useAtom(sideBarOpenAtom);
  return (
    <aside
      data-state={sideBarOpen ? "open" : "closed"}
      className={cx(
        css({
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "container",
          overflow: "auto",
          "@media(width < 48rem)": {
            display: "none",
            translate: "-100%",
            transition: "0.25s allow-discrete",
            "&[data-state='open']": {
              display: "revert",
              translate: 0,
              "@starting-style": {
                translate: "-100%",
              },
            },
          },
          "@media(min-width: 48rem)": {
            position: "revert",
            padding: 0,
            background: "revert",
          },
        }),
        className,
      )}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "end",
          margin: "1rem",
          "@media(min-width: 48rem)": {
            display: "none",
          },
        })}
      >
        <button
          onClick={() => setSideBarOpen(false)}
          className={css({ cursor: "pointer" })}
        >
          <X />
        </button>
      </div>
      <Suspense fallback={<CircularProgressIndicator />}>
        <SuspendableDaos />
        <Button
          className={css({
            margin: "1rem",
            width: "stretch",
          })}
        >
          Add DAO
        </Button>{" "}
      </Suspense>
    </aside>
  );
}

function SuspendableDaos() {
  const account = useAtomValue(selectedAccountAtom);
  const setSelectedDaoId = useSetSelectedDaoId();

  if (account === undefined) {
    return null;
  }

  return <_SuspendableDaos />;

  function _SuspendableDaos() {
    const daoIds = useLazyLoadQuery((builder) =>
      builder.readStorageEntries("CoreAssets", "Accounts", [account!.address]),
    );

    const daos = useLazyLoadQuery((builder) =>
      builder.readStorages(
        "OcifStaking",
        "RegisteredCore",
        daoIds.map(({ keyArgs: [_, coreId] }) => [coreId] as const),
      ),
    )
      .map((dao, index) => {
        const id = daoIds.at(index)?.keyArgs[1];

        return dao === undefined || id === undefined
          ? undefined
          : { ...dao, id };
      })
      .filter((dao) => dao !== undefined);

    const selectedDaoId = useLazyLoadSelectedDaoId();

    return (
      <ul
        className={css({ marginTop: "1rem", "&:empty": { display: "none" } })}
      >
        {daos.map((dao) => (
          <button
            key={dao.account}
            onClick={() => setSelectedDaoId(dao.id)}
            className={css({
              margin: "0 0.5rem",
              borderRadius: "1rem",
              width: "stretch",
              backgroundColor:
                dao.id === selectedDaoId ? "surfaceContainer" : undefined,
              cursor: "pointer",
              textAlign: "start",
            })}
          >
            <AccountListItem
              address={dao.account}
              name={dao.metadata.name.asText()}
            />
          </button>
        ))}
      </ul>
    );
  }
}

export function AccountsSynchronizer() {
  return (
    <Suspense>
      <_AccountsSynchronizer />
    </Suspense>
  );
}

export function _AccountsSynchronizer() {
  const accounts = useAccounts();
  const setAccounts = useSetAtom(accountsAtom);

  useEffect(() => {
    setAccounts(accounts);
  }, [accounts, setAccounts]);

  return null;
}
