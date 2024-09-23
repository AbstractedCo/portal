import { Select } from "./select";
import { PolkadotIdenticon } from "dot-identicon/react.js";
import { useState } from "react";

export const Default = () => {
  const options = [
    {
      value: "invarch",
      label: "InvArch",
      icon: (
        <PolkadotIdenticon address="5CLwQ5xmYfBshb9cwndyybRwbc673Rhh4f6s3i3qXbfDebXJ" />
      ),
    },
    { value: "polkadot", label: "Polkadot" },
    { value: "kusama", label: "Kusama" },
  ] as const;

  const [value, setValue] = useState<(typeof options)[number]["value"]>(
    options[0].value,
  );

  return <Select value={value} options={options} onChangeValue={setValue} />;
};
