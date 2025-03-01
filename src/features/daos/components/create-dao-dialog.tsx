import { css } from "../../../../styled-system/css";
import { AlertDialog } from "../../../components/alert-dialog";
import { Button } from "../../../components/button";
import { TextInput } from "../../../components/text-input";
import { useState } from "react";
import { useMutation } from "@reactive-dot/react";
import { Binary, Enum } from "polkadot-api";
import { pending } from "@reactive-dot/core";

type CreateDaoDialogProps = {
    onClose: () => void;
};

export function CreateDaoDialog({ onClose }: CreateDaoDialogProps) {
    const [name, setName] = useState("");
    const [minimumSupport, setMinimumSupport] = useState(0);
    const [requiredApproval, setRequiredApproval] = useState(0);

    // Convert percentage to perbill (0-100 -> 0-1,000,000,000)
    const percentageToPerbill = (percentage: number) => Math.floor(percentage * 10_000_000);

    const [createDaoState, createDao] = useMutation((builder) =>
        builder.INV4.create_dao({
            metadata: Binary.fromText(name),
            minimum_support: percentageToPerbill(minimumSupport),
            required_approval: percentageToPerbill(requiredApproval),
            creation_fee_asset: Enum("Native"),
        })
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            await createDao();
            onClose();
        } catch (error) {
            console.error("Failed to create DAO:", error);
        }
    };

    return (
        <AlertDialog
            title="Create DAO"
            onClose={onClose}
            className={css({
                containerType: "inline-size",
                width: `min(34rem, 100dvw)`,
            })}
        >
            <form
                onSubmit={handleSubmit}
                className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                    alignItems: "center",
                    textAlign: "center",
                    "& > *": {
                        width: "100%",
                    }
                })}
            >
                <TextInput
                    label="DAO Name"
                    value={name}
                    onChangeValue={setName}
                    placeholder="Enter DAO name"
                />
                <TextInput
                    label="Minimum Support (%)"
                    value={minimumSupport.toString()}
                    onChangeValue={(value) => {
                        const num = value.replace(/[^\d]/g, '');
                        const parsed = parseInt(num);
                        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                            setMinimumSupport(parsed);
                        }
                    }}
                    placeholder="Enter minimum support percentage (0-100)"
                />
                <TextInput
                    label="Required Approval (%)"
                    value={requiredApproval.toString()}
                    onChangeValue={(value) => {
                        const num = value.replace(/[^\d]/g, '');
                        const parsed = parseInt(num);
                        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                            setRequiredApproval(parsed);
                        }
                    }}
                    placeholder="Enter required approval percentage (0-100)"
                />
                <Button
                    type="submit"
                    disabled={createDaoState === pending}
                    className={css({
                        marginTop: "1rem",
                        width: "stretch",
                    })}
                >
                    Create DAO
                </Button>
            </form>
        </AlertDialog>
    );
}
