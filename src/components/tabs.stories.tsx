import { Tabs } from "./tabs";
import { useState } from "react";

export function Default() {
  const [value, setValue] = useState<"invarch" | "polkadot" | "kusama">(
    "polkadot",
  );

  return (
    <Tabs value={value} onChangeValue={setValue}>
      <Tabs.Item value="invarch">InvArch</Tabs.Item>
      <Tabs.Item value="polkadot">Polkadot</Tabs.Item>
      <Tabs.Item value="kusama">Kusama</Tabs.Item>
    </Tabs>
  );
}
