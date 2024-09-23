import { TextInput } from "./text-input";
import { useState } from "react";

export function Default() {
  const [value, setValue] = useState("");

  return (
    <TextInput
      value={value}
      onChangeValue={setValue}
      label="Label"
      supporting="Additional info"
    />
  );
}
