import { css } from "../../../../styled-system/css";
import { ModalDialog } from "../../../components/modal-dialog";
import { Button } from "../../../components/button";
import { TextInput } from "../../../components/text-input";
import { useState } from "react";
import { useMutation, useMutationEffect } from "@reactive-dot/react";
import { Binary, Enum } from "polkadot-api";
import { MutationError, pending } from "@reactive-dot/core";
import { useNotification } from "../../../contexts/notification-context";

type CreateDaoDialogProps = {
    onClose: () => void;
};

export function CreateDaoDialog({ onClose }: CreateDaoDialogProps) {
    const [name, setName] = useState("");
    const [minimumSupport, setMinimumSupport] = useState(0);
    const [requiredApproval, setRequiredApproval] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const { showNotification } = useNotification();

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

    useMutationEffect((event) => {
        setIsProcessing(true);

        if (event.value === pending) {
            showNotification({
                variant: "success",
                message: "Submitting transaction...",
            });
            return;
        }

        if (event.value instanceof MutationError) {
            setIsProcessing(false);
            showNotification({
                variant: "error",
                message: "Failed to submit transaction",
            });
            return;
        }

        switch (event.value.type) {
            case "finalized":
                setIsProcessing(false);
                if (event.value.ok) {
                    showNotification({
                        variant: "success",
                        message: "DAO created successfully!",
                    });
                    onClose();
                } else {
                    showNotification({
                        variant: "error",
                        message: "Transaction failed",
                    });
                }
                break;
            default:
                showNotification({
                    variant: "success",
                    message: "Transaction pending...",
                });
        }
    });

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            await createDao();
        } catch (error) {
            console.error("Failed to create DAO:", error);
            showNotification({
                variant: "error",
                message: "Failed to create DAO: " + (error instanceof Error ? error.message : "Unknown error"),
            });
        }
    };

    return (
        <ModalDialog
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
                    disabled={createDaoState === pending || isProcessing}
                    className={css({
                        marginTop: "1rem",
                        width: "stretch",
                    })}
                >
                    Create DAO
                </Button>
            </form>
        </ModalDialog>
    );
}
