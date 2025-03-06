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
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Validation function
    const isFormValid = () => {
        // Empty values are invalid, user must input something
        if (name.trim() === "" || minimumSupport === "" || requiredApproval === "") {
            return false;
        }

        const minSupport = Number(minimumSupport);
        const reqApproval = Number(requiredApproval);

        return (
            !isNaN(minSupport) && minSupport >= 0 && minSupport <= 100 &&
            !isNaN(reqApproval) && reqApproval >= 0 && reqApproval <= 100
        );
    };

    // Warning for < 51% values
    const showZeroWarning = () => {
        const reqApproval = requiredApproval === "" ? 51 : Number(requiredApproval);
        return reqApproval < 51 && isFormValid();
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
                setShowConfirmation(true);
                return;
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
        <>
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
                        textAlign: "left",
                        "& > *": {
                            width: "100%",
                        }
                    })}
                >
                    <TextInput
                        label={
                            <>
                                DAO Name
                                <br />
                                What would you like your business, organization, or community to be called?
                            </>
                        }
                        value={name}
                        onChangeValue={setName}
                        placeholder="Enter DAO name"
                    />
                    <TextInput
                        label={
                            <>
                                Minimum Support (%)
                                <br />
                                What&apos;s the minimal voter turnout required for a proposal to pass?
                            </>
                        }
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
                        placeholder="51"
                    />
                    <TextInput
                        label={
                            <>
                                Minimum Approval (%)
                                <br />
                                What&apos;s the minimum share of votes required for a proposal to pass?
                            </>
                        }
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
                        placeholder="51"
                    />
                    {showZeroWarning() && (
                        <p className={css({
                            color: 'warning',
                            fontSize: '0.875rem',
                            marginTop: '-0.5rem',
                            textAlign: 'center',
                        })}>
                            Pro-tip: Set the Minimum Approval (%) to at least 51 to ensure a majority is needed to pass proposals, and avoid setting any values to 0 as they might negatively affect the DAO&apos;s governance capabilities.
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

            {showConfirmation && (
                <ModalDialog
                    title="Confirm DAO Settings"
                    onClose={() => setShowConfirmation(false)}
                    className={css({
                        containerType: "inline-size",
                        width: `min(34rem, 100dvw)`,
                    })}
                >
                    <div className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        alignItems: 'center',
                        textAlign: 'center',
                    })}>
                        <p className={css({
                            color: 'warning',
                            fontSize: '1rem',
                            lineHeight: '1.5',
                        })}>
                            You are about to create a DAO with approval settings below 51%.
                            This means proposals can pass without majority support, which
                            might affect the DAO&apos;s governance capabilities.
                            <br /><br />
                            Are you sure you want to proceed?
                        </p>
                        <div className={css({
                            display: 'flex',
                            gap: '1rem',
                            width: '100%',
                            justifyContent: 'center',
                        })}>
                            <Button
                                onClick={async () => {
                                    setShowConfirmation(false);
                                    await createDao();
                                }}
                                className={css({
                                    backgroundColor: 'warning',
                                    color: 'black',
                                    '&:hover': {
                                        backgroundColor: 'warningHover',
                                    },
                                })}
                            >
                                Yes, proceed anyway
                            </Button>
                            <Button
                                onClick={() => setShowConfirmation(false)}
                                className={css({
                                    backgroundColor: 'surface',
                                    color: 'onSurface',
                                })}
                            >
                                No, let me adjust
                            </Button>
                        </div>
                    </div>
                </ModalDialog>
            )}
        </>
    );
}
