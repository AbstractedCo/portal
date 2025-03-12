/* eslint-disable react-hooks/rules-of-hooks */
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
  // useLazyLoadQuery,
  useLazyLoadQueryWithRefresh,
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
import { Menu, X, CopyIcon, ExternalLink } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { CreateDaoDialog } from "../features/daos/components/create-dao-dialog";
import { useNotification } from "../contexts/notification-context";
import { ModalDialog } from "../components/modal-dialog";

registerDotConnect({ wallets: config.wallets ?? [] });

export const Route = createRootRouteWithContext<{
  title?: string | undefined;
}>()({
  component: Root,
});

const sideBarOpenAtom = atom(false);

function Root() {
  const [createDaoDialogOpen, setCreateDaoDialogOpen] = useState(false);

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
                onCreateDao={() => setCreateDaoDialogOpen(true)}
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
            {createDaoDialogOpen && (
              <CreateDaoDialog onClose={() => setCreateDaoDialogOpen(false)} />
            )}
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
          <a
            href="https://portal.invarch.network/staking"
            target="_blank"
            rel="noopener noreferrer"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'inherit',
              textDecoration: 'none',
              '&:hover': {
                color: 'primary'
              }
            })}
          >
            Staking
            <ExternalLink size={14} />
          </a>
        </li>
        <li>
          <a
            href="https://github.com/AbstractedCo/portal/blob/main/ROADMAP.md"
            target="_blank"
            rel="noopener noreferrer"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'inherit',
              textDecoration: 'none',
              '&:hover': {
                color: 'primary'
              }
            })}
          >
            Roadmap
            <ExternalLink size={14} />
          </a>
        </li>
        <li>
          <a
            href="https://docs.invarch.network/creating-daos"
            target="_blank"
            rel="noopener noreferrer"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'inherit',
              textDecoration: 'none',
              '&:hover': {
                color: 'primary'
              }
            })}
          >
            Docs
            <ExternalLink size={14} />
          </a>
        </li>
        {/* <li>
          <Link to="/governance" activeProps={activeProps}>
            Governance
          </Link>
        </li> */}
        {/* <li>
          <Link to="/profile" activeProps={activeProps}>
            Profile
          </Link>
        </li> */}
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
  const [showDialog, setShowDialog] = useState(false);
  const [selectedAccount] = useAtom(selectedAccountIdAtom);

  useEffect(() => {
    if (connectedWallets.length > 0 && !selectedAccount) {
      setShowDialog(true);
    }
  }, [connectedWallets.length, selectedAccount]);

  if (connectedWallets.length === 0) {
    return null;
  }

  return (
    <>
      <Suspense fallback={<CircularProgressIndicator />}>
        <InnerAccountSelect />
      </Suspense>
      {showDialog && (
        <Suspense fallback={<CircularProgressIndicator />}>
          <AccountSelectDialog onClose={() => setShowDialog(false)} />
        </Suspense>
      )}
    </>
  );
}

function InnerAccountSelect() {
  const accounts = useAccounts();
  const [selectedAccount, setSelectedAccount] = useAtom(selectedAccountIdAtom);

  return (
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
  );
}

function AccountSelectDialog({ onClose }: { onClose: () => void }) {
  const accounts = useAccounts();
  const [_, setSelectedAccount] = useAtom(selectedAccountIdAtom);

  return (
    <ModalDialog
      title="Select an Account"
      onClose={onClose}
      className={css({
        containerType: "inline-size",
        width: `min(18rem, 100dvw)`,
      })}
    >
      <div className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      })}>
        <p className={css({ color: 'content.muted' })}>
          Please select an account
        </p>
        <div className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        })}>
          {accounts.map((account) => (
            <Button
              key={account.wallet.id + account.address}
              onClick={() => {
                setSelectedAccount(account.wallet.id + account.address);
                onClose();
              }}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                width: '100%',
                backgroundColor: 'surface',
                '&:hover': { backgroundColor: 'surfaceHover' }
              })}
            >
              <PolkadotIdenticon address={account.address} size={24} />
              <span
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: '24px',
                  paddingLeft: '0.5rem',
                  transform: 'translateY(-6px)',
                })}
              >
                {account.name ?? account.address}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </ModalDialog>
  );
}

type SideBarProps = {
  className?: string | undefined;
  onCreateDao: () => void;
};

function SideBar({ className, onCreateDao }: SideBarProps) {
  const [sideBarOpen, setSideBarOpen] = useAtom(sideBarOpenAtom);
  const selectedAccount = useAtomValue(selectedAccountAtom);

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
          onClick={onCreateDao}
          disabled={!selectedAccount}
          className={css({
            margin: "1rem",
            width: "stretch",
            opacity: selectedAccount ? 1 : 0.5,
            cursor: selectedAccount ? 'pointer' : 'not-allowed',
          })}
        >
          Create DAO
        </Button>
      </Suspense>
    </aside>
  );
}

function SuspendableDaos() {
  const account = useAtomValue(selectedAccountAtom);
  const setSelectedDaoId = useSetSelectedDaoId();
  const { showNotification } = useNotification();

  if (account === undefined) {
    return null;
  }

  return <_SuspendableDaos />;

  function _SuspendableDaos() {
    const [daoIds, refreshDaoIds] = useLazyLoadQueryWithRefresh((builder) =>
      builder.readStorageEntries("CoreAssets", "Accounts", [account!.address])
    );

    const [daos, refreshDaos] = useLazyLoadQueryWithRefresh((builder) =>
      builder.readStorages(
        "INV4",
        "CoreStorage",
        daoIds.map(({ keyArgs: [_, daoId] }) => [daoId] as const),
      ),
    );

    useEffect(() => {
      window.refreshDaoList = async () => {
        await Promise.all([
          refreshDaoIds(),
          refreshDaos()
        ]);
      };
      return () => {
        window.refreshDaoList = undefined;
      };
    }, [refreshDaoIds, refreshDaos]);

    const daosList = daos
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
        {daosList.map((dao) => (
          <div
            key={dao.account}
            className={css({
              margin: "0 0.5rem",
              padding: "0.25rem",
              borderRadius: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor:
                dao.id === selectedDaoId ? "surfaceContainer" : undefined,
            })}
          >
            <button
              onClick={() => setSelectedDaoId(dao.id)}
              className={css({
                flex: 1,
                cursor: "pointer",
                textAlign: "start",
              })}
            >
              <AccountListItem
                address={dao.account}
                name={dao.metadata.asText()}
              />
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(dao.account);
                showNotification({
                  variant: "success",
                  message: "DAO address copied to clipboard",
                });
              }}
              className={css({
                display: "flex",
                alignItems: "center",
                padding: "0.5rem",
                borderRadius: "0.5rem",
                color: "content.muted",
                "&:hover": {
                  color: "content.default",
                  backgroundColor: "surface.hover",
                },
              })}
            >
              <CopyIcon size={16} />
            </button>
          </div>
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
