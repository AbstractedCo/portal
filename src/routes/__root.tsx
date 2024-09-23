import { css, cx } from "../../styled-system/css";
import { Button } from "../components/button";
import { config } from "../config";
import { AccountListItem } from "../widgets/account-list-item";
import { Logo } from "../widgets/logo";
import {
  ChainProvider,
  ReactiveDotProvider,
  useAccounts,
} from "@reactive-dot/react";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { registerDotConnect } from "dot-connect";
import "dot-connect/font.css";
import { ConnectionButton } from "dot-connect/react.js";
import { atom, useAtom, useSetAtom } from "jotai";
import { Menu, X } from "lucide-react";
import { Suspense } from "react";

registerDotConnect({ wallets: config.wallets });

export const Route = createRootRoute({
  component: Root,
});

const sideBarOpenAtom = atom(false);

function Root() {
  return (
    <ReactiveDotProvider config={config}>
      <ChainProvider chainId="tinkernet">
        <Suspense fallback="loading...">
          <div
            className={css({
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: "100dvh",
              "@media(min-width: 48rem)": {
                height: "100dvh",
                display: "grid",
                gridTemplateAreas: `
                  "logo nav"
                  "side main"
                `,
                gridTemplateColumns: "max-content 1fr",
                gridTemplateRows: "min-content 1fr",
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
            <SideBar
              className={css({
                gridArea: "side",
                width: "100dvw",
                "@media(min-width: 48rem)": {
                  marginTop: "2rem",
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
            </div>
          </div>
        </Suspense>
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
          zIndex: 1,
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
      <div
        className={css({
          margin: "0 1rem",
          width: "stretch",
          "--dc-primary-color": "var(--colors-primary)",
          "--dc-on-primary-color": "var(--colors-on-primary)",
          colorScheme: "dark",
        })}
      >
        <ConnectionButton />
      </div>
      <Suspense
        fallback={
          <div className={css({ textAlign: "center" })}>loading...</div>
        }
      >
        <Accounts />
      </Suspense>
      <Button
        className={css({
          margin: "0 1rem",
          width: "stretch",
        })}
      >
        Add multisig
      </Button>
    </aside>
  );
}

function Accounts() {
  const accounts = useAccounts();
  return (
    <ul>
      {accounts.map((account) => (
        <li key={account.wallet.id + account.address}>
          <AccountListItem address={account.address} name={account.name} />
        </li>
      ))}
    </ul>
  );
}
