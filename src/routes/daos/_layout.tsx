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

const DECIMALS = 12;

export const Route = createFileRoute("/daos/_layout")({
  component: Layout,
});

function Layout() {
  const location = useLocation();
  const personalBalance = useAccountBalance();
  const daoBalance = useDaoBalance();

  const formatDenominated = (balance: bigint) => {
    if (!balance) return "--";
    return new DenominatedNumber(balance, DECIMALS, "VARCH").toLocaleString();
  };

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
      <div
        className={css({
          display: "contents",
          "@media(min-width: 64rem)": {
            flex: "0 0 20rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            position: "sticky",
            top: 0,
            height: "fit-content",
          },
        })}
      >
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
            {/* <dt>Reserved Balance</dt>
            <dd>{formatDenominated(personalBalance.reserved)}</dd>
            <dt>Frozen Balance</dt>
            <dd>{formatDenominated(personalBalance.frozen)}</dd>
            <dt>Total Balance</dt>
            <dd>{formatDenominated(personalBalance.free + personalBalance.reserved)}</dd> */}
          </dl>
        </article>

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
            {/* <dt>Reserved Native Balance</dt>
            <dd>{formatDenominated(daoBalance.reserved)}</dd>
            <dt>Frozen Native Balance</dt>
            <dd>{formatDenominated(daoBalance.frozen)}</dd>
            <dt>Total Native Balance</dt>
            <dd>{formatDenominated(daoBalance.free + daoBalance.reserved)}</dd> */}
          </dl>
        </article>
      </div>
      <div
        className={css({
          display: "contents",
          "@media(min-width: 64rem)": {
            flex: 1,
            display: "revert",
          },
        })}
      >
        <Tabs
          value={location.pathname}
          className={css({
            fontSize: "0.65rem",
            "@media(min-width: 64rem)": {
              fontSize: "revert",
              marginBottom: "2.75rem",
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
      </div>
    </div>
  );
}
