import { css } from "../../../../styled-system/css";
import { Button } from "../../../components/button";
import { ModalDialog } from "../../../components/modal-dialog";
import { TextInput } from "../../../components/text-input";
import { useNotification } from "../../../contexts/notification-context";
import { selectedAccountAtom } from "../../../features/accounts/store";
import { DepositDialog } from "../../../routes/daos/_layout/assets";
import { AccountListItem } from "../../../widgets/account-list-item";
import { useLazyLoadInvArchExistentialDeposit } from "../../assets/store";
import {
  calculateTotalTokens,
  calculateVotingPowerPercentages,
  distributeEqualVotingTokens,
} from "../utils/voting-power";
import { MutationError, pending } from "@reactive-dot/core";
import {
  useLazyLoadQuery,
  useMutation,
  useMutationEffect,
  useTypedApi,
} from "@reactive-dot/react";
import { useAtomValue } from "jotai";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  Trash2Icon,
} from "lucide-react";
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
  const [daoStorage, setDaoStorage] = useState<{
    account: string;
  } | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const EXISTENTIAL_DEPOSIT = useLazyLoadInvArchExistentialDeposit();
  const REQUIRED_BUFFER = EXISTENTIAL_DEPOSIT * 2n;

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

  const [memberTokens, setMemberTokens] = useState<{ [key: string]: string }>(
    {},
  );

  // Update memberTokens when a new member is added
  useEffect(() => {
    const newTokens = { ...memberTokens };
    members.forEach((member) => {
      if (!(member in newTokens)) {
        newTokens[member] = "1000000"; // Set default tokens to 1M for new members
      }
    });
    // Remove tokens for removed members
    Object.keys(newTokens).forEach((member) => {
      if (!members.includes(member) && member !== selectedAccount?.address) {
        delete newTokens[member];
      }
    });
    setMemberTokens(newTokens);
  }, [memberTokens, members, selectedAccount?.address]);

  // Initialize creator's tokens
  useEffect(() => {
    if (
      selectedAccount?.address &&
      !(selectedAccount.address in memberTokens)
    ) {
      setMemberTokens((prev) => ({
        ...prev,
        [selectedAccount.address]: "1000000", // Initial creator tokens
      }));
    }
  }, [memberTokens, selectedAccount?.address]);

  const calculateEqualTokens = () => {
    if (!members.length || !selectedAccount) return;
    setMemberTokens(
      distributeEqualVotingTokens(members, selectedAccount.address),
    );
  };

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

  // Add members mutation
  const [_addMembersState, addMembers] = useMutation((builder) =>
    builder.INV4.operate_multisig({
      dao_id: Number(newDaoId),
      call: builder.Utility.batch_all({
        calls: members.map(
          (member) =>
            builder.INV4.token_mint({
              target: member,
              amount: BigInt(memberTokens[member] || "0"),
            }).decodedCall,
        ),
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
        message: "Failed to submit transaction: " + event.value.message,
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
              message: "Members added successfully!",
            });
            setMembers([]);
            setNewMemberAddress("");
            // Move to complete step after successfully adding members
            setStep("complete");
          }
        } else {
          showNotification({
            variant: "error",
            message:
              "Transaction failed: " + event.value.dispatchError.toString(),
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

  const handleAddMember = () => {
    if (!newMemberAddress || !selectedAccount) return;

    // Don't add if it's the creator's address
    if (newMemberAddress === selectedAccount.address) return;

    // Don't add if the address is already in the list
    if (members.includes(newMemberAddress)) {
      showNotification({
        variant: "error",
        message: "This address is already in the list",
      });
      return;
    }

    setMembers((prev) => [...prev, newMemberAddress]);
    setNewMemberAddress(""); // Clear the input after adding
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
          First add member addresses, then configure their voting power
        </p>
      </div>

      {/* Display current total tokens */}
      <div
        className={css({
          backgroundColor: "surfaceContainer",
          padding: "1rem",
          borderRadius: "0.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "auto",
        })}
      >
        <span className={css({ color: "content.muted" })}>
          Total Voting Tokens:
        </span>
        <span>{calculateTotalTokens(memberTokens).toString()}</span>
      </div>

      {/* Add member form */}
      <div
        className={css({
          display: "flex",
          gap: "1rem",
          alignItems: "center",
        })}
      >
        <TextInput
          label="Add Members"
          value={newMemberAddress}
          onChangeValue={setNewMemberAddress}
          placeholder="Enter member's address"
          className={css({ flex: 1 })}
        />
        <button
          onClick={handleAddMember}
          disabled={
            !newMemberAddress || newMemberAddress === selectedAccount?.address
          }
          className={css({
            color: "primary",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "0.5rem",
            marginTop: "1.5rem",
            "&:disabled": {
              color: "content.muted",
              cursor: "not-allowed",
            },
            "&:not(:disabled):hover": {
              color: "primaryHover",
            },
          })}
        >
          <PlusCircleIcon size={20} />
        </button>
      </div>

      {/* Equal voting power distribution button */}
      {(members.length > 0 || selectedAccount) && (
        <button
          onClick={calculateEqualTokens}
          className={css({
            color: "primary",
            fontSize: "0.875rem",
            padding: "0.5rem",
            width: "fit-content",
            marginLeft: "auto",
            marginRight: "auto",
            cursor: "pointer",
            "&:hover": {
              textDecoration: "underline",
            },
          })}
        >
          Distribute equal voting power to all members
        </button>
      )}

      {/* Member list with token configuration */}
      <div
        className={css({
          backgroundColor: "surfaceContainer",
          borderRadius: "0.5rem",
          overflow: "hidden",
        })}
      >
        <table
          className={css({
            width: "100%",
            borderCollapse: "collapse",
          })}
        >
          <thead>
            <tr
              className={css({
                color: "content.muted",
                fontSize: "0.875rem",
              })}
            >
              <th
                className={css({
                  padding: ".75rem",
                  textAlign: "left",
                })}
              >
                Address
              </th>
              <th
                className={css({
                  padding: "0.75rem",
                  textAlign: "right",
                  paddingLeft: "7rem",
                  // paddingRight: "0rem",
                })}
              >
                Voting Tokens
              </th>
              <th
                className={css({
                  padding: "0.75rem",
                  textAlign: "right",
                })}
              >
                Voting Power
              </th>
              <th className={css({ width: "48px" })}></th>
            </tr>
          </thead>
        </table>

        <div
          className={css({
            maxHeight: "30vh",
            overflowY: "auto",
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-track": {
              background: "surface",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "surfaceContainer",
              borderRadius: "3px",
            },
          })}
        >
          <table
            className={css({
              width: "100%",
              borderCollapse: "collapse",
            })}
          >
            <tbody>
              {/* Creator's row (non-removable) */}
              {selectedAccount && (
                <tr>
                  <td
                    className={css({
                      padding: "0.75rem",
                      paddingRight: "0rem",
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                      })}
                    >
                      <AccountListItem address={selectedAccount.address} />
                      <span
                        className={css({
                          color: "content.muted",
                          fontSize: "0.75rem",
                        })}
                      >
                        (Creator)
                      </span>
                    </div>
                  </td>
                  <td className={css({ padding: "0.75rem" })}>
                    <div
                      className={css({
                        // width: "100%",
                        alignItems: "center",
                        padding: "0.5rem",
                        backgroundColor: "surface",
                        borderRadius: "0.375rem",
                        color: "content.muted",
                        textAlign: "right",
                      })}
                    >
                      {memberTokens[selectedAccount.address] || "1000000"}
                    </div>
                  </td>
                  <td
                    className={css({
                      padding: "0.75rem",
                      textAlign: "right",
                    })}
                  >
                    {calculateVotingPowerPercentages(memberTokens)[
                      selectedAccount.address
                    ]?.toFixed(2)}
                    %
                  </td>
                  <td></td>
                </tr>
              )}

              {/* Member rows */}
              {members.map((member) => (
                <tr
                  key={member}
                  className={css({
                    "&:hover": { backgroundColor: "surfaceHover" },
                  })}
                >
                  <td className={css({ padding: "0.75rem", width: "50%" })}>
                    <AccountListItem address={member} />
                  </td>
                  <td
                    className={css({
                      padding: "0.75rem",
                      width: "25%",
                      minWidth: "120px",
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                        justifyContent: "flex-end",
                      })}
                    >
                      <TextInput
                        value={memberTokens[member] || "0"}
                        onChangeValue={(value) => {
                          if (value === "" || /^\d+$/.test(value)) {
                            setMemberTokens((prev) => ({
                              ...prev,
                              [member]: value,
                            }));
                          }
                        }}
                        className={css({
                          width: "120px",
                          "& input": {
                            textAlign: "right",
                          },
                        })}
                      />
                    </div>
                  </td>
                  <td
                    className={css({
                      padding: "0.75rem",
                      textAlign: "right",
                      width: "15%",
                      whiteSpace: "nowrap",
                    })}
                  >
                    {calculateVotingPowerPercentages(memberTokens)[
                      member
                    ]?.toFixed(2)}
                    %
                  </td>
                  <td
                    className={css({
                      padding: "0.75rem",
                      textAlign: "center",
                      width: "10%",
                    })}
                  >
                    <button
                      onClick={() =>
                        setMembers(members.filter((m) => m !== member))
                      }
                      className={css({
                        color: "error",
                        padding: "0.5rem",
                        borderRadius: "0.25rem",
                        "&:hover": {
                          opacity: 0.8,
                          backgroundColor: "surfaceHover",
                        },
                      })}
                    >
                      <Trash2Icon size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(members.length > 0 || selectedAccount) && (
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            marginTop: "1rem",
            gap: "1rem",
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
          <Button
            onClick={() => addMembers()}
            disabled={isProcessing || members.length === 0}
          >
            Add Members
          </Button>
        </div>
      )}
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
        DAO Setup Complete!
      </h3>
      <p className={css({ color: "content.muted", lineHeight: "1.5" })}>
        Congratulations! Your DAO has been created and configured successfully.
        You can now start managing your DAO, create proposals, and collaborate
        with your members.
        <br />
        <br />
        The DAO is now ready for:
        <br />• Creating and voting on proposals
        <br />• Managing assets and treasury
        <br />• Adding more members
        <br />• Configuring additional settings
      </p>
      <Button onClick={onClose}>Start Using Your DAO</Button>
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
          maxHeight: "100%",
          overflow: "auto",
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
