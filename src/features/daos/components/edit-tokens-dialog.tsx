import { ModalDialog } from "../../../components/modal-dialog";
import { Button } from "../../../components/button";
import { TextInput } from "../../../components/text-input";
import { css } from "../../../../styled-system/css";
import { useState } from "react";

interface EditTokensDialogProps {
  address: string;
  currentBalance: bigint;
  currentTotalTokens: bigint;
  onClose: () => void;
  onSubmit: (amount: bigint) => void;
}

export function EditTokensDialog({
  address,
  currentBalance,
  currentTotalTokens,
  onClose,
  onSubmit,
}: EditTokensDialogProps) {
  const [newAmount, setNewAmount] = useState("");

  // Calculate the difference and future percentages
  const difference = newAmount ? BigInt(newAmount) - currentBalance : 0n;
  const futureTotalTokens = currentTotalTokens + difference;
  const futureBalance = newAmount ? BigInt(newAmount) : currentBalance;
  const futurePercentage = futureTotalTokens === 0n ? 0 : Number((futureBalance * 10000n) / futureTotalTokens) / 100;
  const currentPercentage = currentTotalTokens === 0n ? 0 : Number((currentBalance * 10000n) / currentTotalTokens) / 100;

  const isDecrease = difference < 0n;
  const hasChanges = newAmount && BigInt(newAmount) !== currentBalance;

  return (
    <ModalDialog
      title="Edit Voting Tokens"
      onClose={onClose}
      className={css({
        containerType: "inline-size",
        width: `min(30rem, 100dvw)`,
      })}
      confirmButton={
        <Button
          onClick={() => {
            if (hasChanges) {
              onSubmit(difference);
            }
          }}
          disabled={!hasChanges}
          className={css({
            backgroundColor: isDecrease ? 'error' : 'primary',
            color: isDecrease ? 'on-error' : 'on-primary',
            width: "stretch",
          })}
        >
          {isDecrease ? 'Burn Tokens' : 'Mint Tokens'}
        </Button>
      }
    >
      <div className={css({
        display: 'flex',
        flexDirection: 'column',

        minWidth: '400px',
      })}>
        <div>
          <TextInput
            label={`New Token Amount for Address: ${address}`}
            value={newAmount}
            className={css({
              width: '100%',
            })}
            onChangeValue={(value) => {
              if (value === "" || (/^\d+$/.test(value) && BigInt(value) <= (2n ** 128n - 1n))) {
                setNewAmount(value);
              }
            }}
            placeholder={currentBalance.toString()}
          />
          <div className={css({
            marginTop: '0.1rem',
            fontSize: '0.875rem',
            color: 'content.muted',
            display: 'flex',
            alignItems: 'center',
          })}>
            <span>Current Balance:&#160;</span>
            <span>{currentBalance.toString()} tokens ({currentPercentage.toFixed(2)}% voting strength)</span>
          </div>
        </div>

        {hasChanges && (
          <div className={css({
            backgroundColor: isDecrease ? 'error.container' : 'primary.container',
            paddingTop: '1.5rem',
            fontSize: '0.875rem',
            textAlign: 'center',
          })}>
            <p className={css({
              fontWeight: 'medium',
              color: isDecrease ? 'error' : 'success',
            })}>
              This will {isDecrease ? 'burn' : 'mint'} {Math.abs(Number(difference))} tokens
            </p>
            <div className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            })}>
              <p>
                New voting strength: <strong>{futurePercentage.toFixed(2)}%</strong>
              </p>
              <p className={css({
                color: 'content.muted',
                fontSize: '0.75rem',
              })}>
                Based on future total supply of {futureTotalTokens.toString()} tokens
              </p>
            </div>
          </div>
        )}
      </div>
    </ModalDialog>
  );
} 