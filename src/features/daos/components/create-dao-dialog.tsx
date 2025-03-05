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

declare global {
    interface Window {
        refreshDaoList?: (() => Promise<void>) | undefined;
    }
}

export function CreateDaoDialog({ onClose }: CreateDaoDialogProps) {
    const [name, setName] = useState("");
    const [minimumSupport, setMinimumSupport] = useState<string>("");
    const [requiredApproval, setRequiredApproval] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);
    const { showNotification } = useNotification();

    // Validation function
    const isFormValid = () => {
        const minSupport = Number(minimumSupport);
        const reqApproval = Number(requiredApproval);
        return (
            name.trim().length > 0 &&  // Check name is not empty
            !isNaN(minSupport) && minSupport >= 0 && minSupport <= 100 &&
            !isNaN(reqApproval) && reqApproval >= 0 && reqApproval <= 100
        );
    };

    // Warning for 0% values
    const showZeroWarning = () => {
        const minSupport = Number(minimumSupport);
        const reqApproval = Number(requiredApproval);
        return (minSupport === 0 || reqApproval === 0) && isFormValid();
    };

    // Convert percentage to perbill (0-100 -> 0-1,000,000,000)
    const percentageToPerbill = (percentage: string) =>
        Math.floor(Number(percentage) * 10_000_000);

    const [createDaoState, createDao] = useMutation((builder) =>
        builder.INV4.create_dao({
            metadata: Binary.fromText(name.trim()),
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
                    // Refresh the DAO list when creation is finalized
                    window.refreshDaoList?.();
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
            if (showZeroWarning()) {
                const confirm = window.confirm(
                    "Are you sure you want to proceed with 0% values? This might affect the DAO's governance."
                );
                if (!confirm) return;
            }
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
                    value={minimumSupport}
                    onChangeValue={(value) => {
                        // Allow empty value or numbers only
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                            const num = Number(value);
                            if (value === "" || (num >= 0 && num <= 100)) {
                                setMinimumSupport(value);
                            }
                        }
                    }}
                    placeholder="50"
                />
                <TextInput
                    label="Required Approval (%)"
                    value={requiredApproval}
                    onChangeValue={(value) => {
                        // Allow empty value or numbers only
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                            const num = Number(value);
                            if (value === "" || (num >= 0 && num <= 100)) {
                                setRequiredApproval(value);
                            }
                        }
                    }}
                    placeholder="50"
                />
                {showZeroWarning() && (
                    <p className={css({
                        color: 'warning',
                        fontSize: '0.875rem',
                        marginTop: '-0.5rem',
                    })}>
                        Warning: Setting values to 0% might affect the DAO&apos;s governance capabilities.
                    </p>
                )}
                <Button
                    type="submit"
                    disabled={!isFormValid() || createDaoState === pending || isProcessing}
                    className={css({
                        marginTop: "1rem",
                        width: "stretch",
                        opacity: !isFormValid() ? 0.5 : 1,
                    })}
                >
                    Create DAO
                </Button>
            </form>
        </ModalDialog>
    );
}
