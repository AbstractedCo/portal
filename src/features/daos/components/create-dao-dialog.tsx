import { css } from "../../../../styled-system/css";
import { Button } from "../../../components/button";
import { ModalDialog } from "../../../components/modal-dialog";
import { TextInput } from "../../../components/text-input";
import { useNotification } from "../../../contexts/notification-context";
import { selectedAccountAtom } from "../../../features/accounts/store";
import { DepositDialog } from "../../../routes/daos/_layout/assets";
import { useLazyLoadInvArchExistentialDeposit } from "../../assets/store";
import { MutationError, pending } from "@reactive-dot/core";
import {
  useLazyLoadQuery,
  useMutation,
  useMutationEffect,
  useTypedApi,
} from "@reactive-dot/react";
import { useAtomValue } from "jotai";
import { ArrowRightIcon, CheckCircleIcon, PlusIcon } from "lucide-react";
import { Binary, Enum } from "polkadot-api";
import { useState, useEffect, useRef } from "react";

type CreateDaoDialogProps = {
  onClose: () => void;
};

type Step = "create" | "fund" | "add-members" | "complete";

declare global {
  interface Window {
    refreshDaoList?: (() => Promise<void>) | undefined;
  }
}

// Constants adjusted for 12 decimals
const DECIMALS = 12;

const DAO_CREATION_COST = 5000n * BigInt(10 ** DECIMALS); // Convert 5000 VARCH to chain units

// Type guard for DAO storage
const isDaoStorageValid = (
  storage: unknown,
): storage is { account: string } => {
  return (
    storage !== null &&
    typeof storage === "object" &&
    "account" in storage &&
    typeof storage.account === "string"
  );
};

export function CreateDaoDialog({ onClose }: CreateDaoDialogProps) {
  const selectedAccount = useAtomValue(selectedAccountAtom);
  const api = useTypedApi();
  const nativeBalance = useLazyLoadQuery((builder) =>
    builder.readStorage("System", "Account", [selectedAccount!.address]),
  ).data.free;

  // Format balance to a readable number
  const formatBalance = (balance: bigint) => {
    return Number(balance) / Math.pow(10, DECIMALS);
  };

  const [step, setStep] = useState<Step>("create");
  const [name, setName] = useState("");
  const [minimumSupport, setMinimumSupport] = useState<string>("");
  const [requiredApproval, setRequiredApproval] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { showNotification } = useNotification();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [newDaoId, setNewDaoId] = useState<string>("");
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const EXISTENTIAL_DEPOSIT = useLazyLoadInvArchExistentialDeposit();
  const REQUIRED_BUFFER = EXISTENTIAL_DEPOSIT * 2n;

  // Add state for storing DAO storage
  const [daoStorage, setDaoStorage] = useState<{
    account: string;
  } | null>(null);

  // Query DAO storage when ID changes
  const daoStorageQuery = useLazyLoadQuery((builder) =>
    newDaoId
      ? builder.readStorage("INV4", "CoreStorage", [Number(newDaoId)])
      : null,
  );

  // Update DAO storage when query result changes
  useEffect(() => {
    if (daoStorageQuery && isDaoStorageValid(daoStorageQuery)) {
      setDaoStorage(daoStorageQuery);
    }
  }, [daoStorageQuery]);

  // Validation function
  const isFormValid = () => {
    // Empty values are invalid, user must input something
    if (
      name.trim() === "" ||
      minimumSupport === "" ||
      requiredApproval === ""
    ) {
      return false;
    }

    const minSupport = Number(minimumSupport);
    const reqApproval = Number(requiredApproval);

    return (
      !isNaN(minSupport) &&
      minSupport >= 0 &&
      minSupport <= 100 &&
      !isNaN(reqApproval) &&
      reqApproval >= 0 &&
      reqApproval <= 100
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
    }),
  );

  // Add member mutation
  const [_, addMember] = useMutation((builder) =>
    builder.INV4.operate_multisig({
      dao_id: Number(newDaoId),
      call: builder.INV4.token_mint({
        target: newMemberAddress,
        amount: BigInt(amount) || 1n,
      }).decodedCall,
      fee_asset: { type: "Native", value: undefined },
      metadata: undefined,
    }),
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
          if (step === "create") {
            showNotification({
              variant: "success",
              message: "DAO created successfully!",
            });
            // Get the event data using the api instance
            api.event.INV4.DaoCreated.pull().then((events) => {
              const latestEvent = events[events.length - 1];
              if (latestEvent?.payload.dao_id) {
                setNewDaoId(latestEvent.payload.dao_id.toString());
                setStep("fund");
                // Refresh the DAO list when creation is finalized
                window.refreshDaoList?.();
              }
            });
          } else if (step === "add-members") {
            showNotification({
              variant: "success",
              message: "Member added successfully!",
            });
            // Clear the input field after successful addition
            setNewMemberAddress("");
            // Add the member to the list
            setMembers([...members, newMemberAddress]);
          }
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
        message:
          "Failed to create DAO: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
    }
  };

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMemberAddress || !newDaoId) return;

    try {
      await addMember();
    } catch (error) {
      console.error("Failed to add member:", error);
      showNotification({
        variant: "error",
        message:
          "Failed to add member: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
    }
  };

  const renderStepIndicator = () => {
    const steps: { key: Step; label: string }[] = [
      { key: "create", label: "Create DAO" },
      { key: "fund", label: "Fund DAO" },
      { key: "add-members", label: "Add Members" },
      { key: "complete", label: "Complete" },
    ];

    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          position: "relative",
          marginBottom: "2rem",
        })}
      >
        {steps.map((stepInfo, index) => (
          <div
            key={stepInfo.key}
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              zIndex: 1,
            })}
          >
            <div
              className={css({
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  step === stepInfo.key
                    ? "primary"
                    : steps.findIndex((s) => s.key === step) > index
                      ? "primary"
                      : "surface",
                color:
                  step === stepInfo.key
                    ? "onPrimary"
                    : steps.findIndex((s) => s.key === step) > index
                      ? "onPrimary"
                      : "content",
                marginBottom: "0.5rem",
              })}
            >
              {index + 1}
            </div>
            <span
              className={css({
                fontSize: "0.8rem",
                color: step === stepInfo.key ? "content" : "content.muted",
              })}
            >
              {stepInfo.label}
            </span>
          </div>
        ))}

        {/* Connecting line between steps */}
        <div
          className={css({
            position: "absolute",
            top: "1rem",
            left: "2.5rem",
            right: "2.5rem",
            height: "2px",
            backgroundColor: "surface",
            zIndex: 0,
          })}
        >
          <div
            className={css({
              height: "100%",
              backgroundColor: "primary",
              width:
                step === "create"
                  ? "0%"
                  : step === "fund"
                    ? "33%"
                    : step === "add-members"
                      ? "66%"
                      : "100%",
              transition: "width 0.3s ease-in-out",
            })}
          ></div>
        </div>
      </div>
    );
  };

  const renderCreateStep = () => (
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
        },
      })}
    >
      <TextInput
        label={
          <>
            DAO Name
            <br />
            What would you like your business, organization, or community to be
            called?
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
            What&apos;s the minimal voter turnout required for a proposal to
            pass?
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
            What&apos;s the minimum share of votes required for a proposal to
            pass?
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
        <p
          className={css({
            color: "warning",
            fontSize: "0.875rem",
            marginTop: "-0.5rem",
            textAlign: "center",
          })}
        >
          Pro-tip: Set the Minimum Approval (%) to at least 51 to ensure a
          majority is needed to pass proposals, and avoid setting any values to
          0 as they might negatively affect the DAO&apos;s governance
          capabilities.
        </p>
      )}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            backgroundColor: "surface",
            borderRadius: "0.5rem",
            margin: "0 auto",
            width: "fit-content",
            minWidth: "200px",
          })}
        >
          <p
            className={css({
              color: "content.default",
              fontSize: "0.875rem",
              textAlign: "center",
            })}
          >
            Creation cost: 5000 VARCH
          </p>
          <p
            className={css({
              color: "content.muted",
              fontSize: "0.75rem",
              textAlign: "center",
            })}
          >
            Your balance:{" "}
            {nativeBalance
              ? `${formatBalance(nativeBalance).toLocaleString()} VARCH`
              : "Loading..."}
          </p>
          {typeof nativeBalance !== "undefined" &&
            nativeBalance < DAO_CREATION_COST + REQUIRED_BUFFER && (
              <p
                className={css({
                  color: "error",
                  fontSize: "0.75rem",
                  textAlign: "center",
                  paddingTop: "0.25rem",
                })}
              >
                {`Insufficient balance. You need ${formatBalance(DAO_CREATION_COST + REQUIRED_BUFFER - nativeBalance).toLocaleString()} more VARCH (including ${formatBalance(REQUIRED_BUFFER).toLocaleString()} VARCH minimum balance requirement)`}
              </p>
            )}
        </div>
      </div>
      <Button
        type="submit"
        disabled={
          !isFormValid() ||
          createDaoState === pending ||
          isProcessing ||
          (typeof nativeBalance !== "undefined" &&
            nativeBalance < DAO_CREATION_COST + REQUIRED_BUFFER)
        }
        className={css({
          marginTop: "1rem",
          width: "stretch",
          opacity:
            !isFormValid() ||
            (typeof nativeBalance !== "undefined" &&
              nativeBalance < DAO_CREATION_COST + REQUIRED_BUFFER)
              ? 0.5
              : 1,
        })}
      >
        Create DAO
      </Button>
    </form>
  );

  const FundStep = () => {
    const [transferAmount, setTransferAmount] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDepositDialog, setShowDepositDialog] = useState(false);
    const selectedAccount = useAtomValue(selectedAccountAtom);
    const { showNotification } = useNotification();
    const api = useTypedApi();
    const daoBalanceRef = useRef<{
      free: bigint;
      reserved: bigint;
      frozen: bigint;
      flags: bigint;
    } | null>(null);

    // Get the user's balance
    const userBalance = useLazyLoadQuery((builder) =>
      selectedAccount?.address
        ? builder.readStorage("System", "Account", [selectedAccount.address])
        : undefined,
    );

    // Get the DAO's balance
    const daoBalance = useLazyLoadQuery((builder) =>
      daoStorage?.account
        ? builder.readStorage("System", "Account", [daoStorage.account])
        : undefined,
    );

    // Set up polling for DAO balance
    useEffect(() => {
      if (!daoStorage?.account) return;

      const pollBalance = async () => {
        try {
          const balance = await api.query.System.Account.getValue(
            daoStorage.account,
          );
          if (balance) {
            daoBalanceRef.current = balance.data;
          }
        } catch (error) {
          console.error("Failed to poll balance:", error);
        }
      };

      // Start polling immediately
      pollBalance();
      const intervalId = setInterval(pollBalance, 500);
      return () => clearInterval(intervalId);
    }, [api]);

    // Type guard function for balance
    const isBalanceValid = (
      balance: unknown,
    ): balance is {
      data: { free: bigint; reserved: bigint; frozen: bigint; flags: bigint };
    } => {
      return (
        balance !== null &&
        typeof balance === "object" &&
        "data" in balance &&
        balance.data !== null &&
        typeof balance.data === "object" &&
        "free" in balance.data &&
        typeof balance.data.free === "bigint"
      );
    };

    const hasSufficientFunds =
      (daoBalanceRef.current &&
        daoBalanceRef.current.free > EXISTENTIAL_DEPOSIT) ||
      (daoBalance &&
        isBalanceValid(daoBalance) &&
        daoBalance.data.free > EXISTENTIAL_DEPOSIT);

    // Update the balance displays
    const formatBalanceDisplay = (balance: unknown) => {
      if (balance && isBalanceValid(balance)) {
        return formatBalance(balance.data.free);
      }
      return "0";
    };

    // Set up the transfer mutation for native VARCH
    const [_transferState, executeTransfer] = useMutation((builder) => {
      if (
        !daoStorage?.account ||
        !transferAmount ||
        !selectedAccount?.address
      ) {
        throw new Error("Missing required parameters for transfer");
      }

      const rawAmount = BigInt(
        Math.floor(parseFloat(transferAmount) * Math.pow(10, DECIMALS)),
      );
      if (!rawAmount) {
        throw new Error("Could not convert amount to the correct format");
      }

      // Regular transfer of native VARCH to the DAO account
      return builder.Balances.transfer_keep_alive({
        dest: {
          type: "Id",
          value: daoStorage.account,
        },
        value: rawAmount,
      });
    });

    // Handle transfer mutation events
    useMutationEffect((event) => {
      if (event.value === pending) {
        setIsProcessing(true);
        showNotification({
          variant: "success",
          message: "Submitting VARCH transfer...",
        });
        return;
      }

      if (event.value instanceof MutationError) {
        setIsProcessing(false);
        showNotification({
          variant: "error",
          message: "Failed to submit transfer",
        });
        return;
      }

      switch (event.value.type) {
        case "finalized":
          setIsProcessing(false);
          if (event.value.ok) {
            showNotification({
              variant: "success",
              message: `Transfer of ${transferAmount} VARCH was successful!`,
            });
            setTransferAmount("");
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

    const handleTransfer = async () => {
      try {
        if (!transferAmount || parseFloat(transferAmount) <= 0) {
          showNotification({
            variant: "error",
            message: "Please enter a valid amount",
          });
          return;
        }
        await executeTransfer();
      } catch (error) {
        console.error("Failed to transfer:", error);
        showNotification({
          variant: "error",
          message:
            "Failed to transfer: " +
            (error instanceof Error ? error.message : "Unknown error"),
        });
      }
    };

    if (!selectedAccount || !daoStorage) {
      return (
        <div className={css({ textAlign: "center", color: "error" })}>
          Error: Missing account or DAO information
        </div>
      );
    }

    return (
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        })}
      >
        <div
          className={css({
            textAlign: "center",
            marginBottom: "1rem",
          })}
        >
          <h3 className={css({ fontSize: "1.1rem", fontWeight: "bold" })}>
            Fund Your DAO
          </h3>
          <p className={css({ color: "content.muted", marginTop: "0.5rem" })}>
            Your DAO needs VARCH to perform actions. Please fund it before
            proceeding.
          </p>
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
          })}
        >
          {daoStorage && (
            <>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  width: "100%",
                  maxWidth: "400px",
                })}
              >
                <p className={css({ color: "content.muted" })}>DAO Address:</p>
                <button
                  onClick={() => setShowDepositDialog(true)}
                  className={css({
                    marginLeft: "auto",
                    color: "primary",
                    fontSize: "0.875rem",
                    "&:hover": {
                      textDecoration: "underline",
                    },
                  })}
                >
                  Show QR Code
                </button>
              </div>
              <div
                className={css({
                  backgroundColor: "surfaceContainer",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  wordBreak: "break-all",
                  fontSize: "0.875rem",
                  width: "100%",
                  maxWidth: "400px",
                  textAlign: "left",
                  fontFamily: "monospace",
                })}
              >
                {daoStorage.account}
              </div>
            </>
          )}

          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              width: "100%",
              maxWidth: "400px",
              marginTop: "0.5rem",
            })}
          >
            {/* Balance Information */}
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                backgroundColor: "surfaceContainer",
                padding: "1rem 1.25rem",
                borderRadius: "0.5rem",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                })}
              >
                <span className={css({ color: "content.muted" })}>
                  Your current balance:
                </span>
                <span className={css({ fontFamily: "monospace" })}>
                  {userBalance ? formatBalanceDisplay(userBalance) : "0"} VARCH
                </span>
              </div>
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                })}
              >
                <span className={css({ color: "content.muted" })}>
                  DAO balance:
                </span>
                <span className={css({ fontFamily: "monospace" })}>
                  {daoBalance ? formatBalanceDisplay(daoBalance) : "0"} VARCH
                </span>
              </div>
            </div>

            <TextInput
              label="Amount (VARCH)"
              value={transferAmount}
              className={css({
                width: "100%",
              })}
              onChangeValue={(value) => {
                // Allow decimal points and numbers
                const regex = new RegExp(`^\\d*\\.?\\d{0,${DECIMALS}}$`);
                if (value === "" || regex.test(value)) {
                  setTransferAmount(value);
                }
              }}
              placeholder="Enter amount to transfer"
            />
            <Button
              onClick={handleTransfer}
              disabled={
                isProcessing ||
                !transferAmount ||
                parseFloat(transferAmount) <= 0
              }
              className={css({
                width: "100%",
              })}
            >
              {isProcessing ? "Processing..." : "Transfer VARCH"}
            </Button>
          </div>

          <p
            className={css({
              color: "primary",
              fontSize: "0.875rem",
              marginTop: "0.5rem",
              fontWeight: "500",
            })}
          >
            Recommended: Add at least 50 VARCH to ensure smooth operation
          </p>
          {!hasSufficientFunds && (
            <p
              className={css({
                color: "warning",
                fontSize: "0.875rem",
                marginTop: "0.5rem",
                textAlign: "center",
              })}
            >
              Please fund the DAO with at least {1} VARCH to continue
            </p>
          )}
        </div>

        <div
          className={css({
            display: "flex",
            justifyContent: "center",
            marginTop: "1rem",
          })}
        >
          <Button
            onClick={() => setStep("add-members")}
            disabled={!hasSufficientFunds}
            className={css({
              opacity: !hasSufficientFunds ? 0.5 : 1,
            })}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>Continue</span>
              <ArrowRightIcon size={16} />
            </div>
          </Button>
        </div>

        {showDepositDialog && daoStorage && (
          <DepositDialog
            daoAddress={daoStorage.account}
            onClose={() => setShowDepositDialog(false)}
          />
        )}
      </div>
    );
  };

  const renderAddMembersStep = () => (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      })}
    >
      <div
        className={css({
          textAlign: "center",
          marginBottom: "1rem",
        })}
      >
        <h3 className={css({ fontSize: "1.1rem", fontWeight: "bold" })}>
          Add Members (Optional)
        </h3>
        <p className={css({ color: "content.muted", marginTop: "0.5rem" })}>
          You can add members now or skip this step and add them later
        </p>
      </div>

      <form
        onSubmit={handleAddMember}
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "1rem",
        })}
      >
        <TextInput
          label="Member Address"
          value={newMemberAddress}
          onChangeValue={setNewMemberAddress}
          placeholder="Enter member's address"
        />
        <div
          className={css({
            display: "flex",
            gap: "1rem",
          })}
        >
          <TextInput
            label="Voting Tokens"
            value={amount}
            onChangeValue={(value) => {
              // Allow only positive integers
              if (value === "" || /^\d+$/.test(value)) {
                setAmount(value);
              }
            }}
            placeholder="Enter number of tokens (default: 1)"
            className={css({ flex: 1 })}
          />
          <Button
            type="submit"
            disabled={!newMemberAddress || isProcessing}
            className={css({
              marginTop: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            })}
          >
            <PlusIcon size={16} />
            Add
          </Button>
        </div>
      </form>

      {members.length > 0 && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          })}
        >
          <h4 className={css({ fontSize: "0.9rem", color: "content.muted" })}>
            Added Members:
          </h4>
          <ul
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            })}
          >
            {members.map((member, index) => (
              <li
                key={index}
                className={css({
                  padding: "0.5rem",
                  backgroundColor: "surfaceContainer",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                })}
              >
                {member}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          marginTop: "1rem",
        })}
      >
        <Button
          onClick={() => setStep("complete")}
          className={css({
            backgroundColor: "surface",
            color: "onSurface",
          })}
        >
          Skip
        </Button>
        <Button onClick={() => setStep("complete")}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>Continue</span>
            <ArrowRightIcon size={16} />
          </div>
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        alignItems: "center",
        textAlign: "center",
      })}
    >
      <div
        className={css({
          width: "4rem",
          height: "4rem",
          borderRadius: "50%",
          backgroundColor: "success",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
        })}
      >
        <CheckCircleIcon size={32} color="white" />
      </div>
      <h3 className={css({ fontSize: "1.25rem", fontWeight: "bold" })}>
        DAO Created Successfully!
      </h3>
      <p className={css({ color: "content.muted" })}>
        Your DAO has been created
        {members.length > 0 ? " and members have been added" : ""}. You can now
        start managing your DAO.
      </p>
      <Button onClick={onClose}>Close</Button>
    </div>
  );

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
        {renderStepIndicator()}
        {step === "create" && renderCreateStep()}
        {step === "fund" && <FundStep />}
        {step === "add-members" && renderAddMembersStep()}
        {step === "complete" && renderCompleteStep()}
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
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              alignItems: "center",
              textAlign: "center",
            })}
          >
            <p
              className={css({
                color: "warning",
                fontSize: "1rem",
                lineHeight: "1.5",
              })}
            >
              You are about to create a DAO with approval settings below 51%.
              This means proposals can pass without majority support, which
              might affect the DAO&apos;s governance capabilities.
              <br />
              <br />
              Are you sure you want to proceed?
            </p>
            <div
              className={css({
                display: "flex",
                gap: "1rem",
                width: "100%",
                justifyContent: "center",
              })}
            >
              <Button
                onClick={async () => {
                  setShowConfirmation(false);
                  await createDao();
                }}
                className={css({
                  backgroundColor: "warning",
                  color: "black",
                  "&:hover": {
                    backgroundColor: "warningHover",
                  },
                })}
              >
                Yes, proceed anyway
              </Button>
              <Button
                onClick={() => setShowConfirmation(false)}
                className={css({
                  backgroundColor: "surface",
                  color: "onSurface",
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
