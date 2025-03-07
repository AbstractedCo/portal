import { css } from "../../../styled-system/css";
import { Tabs } from "../../components/tabs";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";

export const Route = createFileRoute("/daos/_layout")({
  component: Layout,
});

function Layout() {
  const location = useLocation();
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
            display: "revert",
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
          <header className={css({ fontWeight: "bold" })}>My balance</header>
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
            <dt>Total portfolio value</dt>
            <dd>$--</dd>
            <dt>Transferrable balance</dt>
            <dd>$--</dd>
            <dt>Non-transferable balance</dt>
            <dd>$--</dd>
          </dl>
        </article>
        {/* <article
          className={css({
            backgroundColor: "surfaceContainer",
            borderRadius: "1rem",
            padding: "2rem",
          })}
        >
          <header>Send KSM</header>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              "& label": { display: "flex", alignItems: "center" },
            })}
          >
            <label>
              from{" "}
              <Select
                value="kusama"
                options={[{ value: "kusama", label: "Kusama" }]}
                onChangeValue={() => {}}
              />
            </label>
            <label>
              to{" "}
              <Select
                value="kusama"
                options={[{ value: "kusama", label: "Kusama" }]}
                onChangeValue={() => {}}
              />
            </label>
          </div>
          <TextInput
            value=""
            onChangeValue={() => {}}
            label="Recipient"
            placeholder="Destination address"
          />
          <Button>Perform transaction</Button>
        </article> */}
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
