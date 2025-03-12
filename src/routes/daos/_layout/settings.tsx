import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '../../../components/button'
import { css } from '../../../../styled-system/css'
import { useNotification } from '../../../contexts/notification-context'
import { useLazyLoadDaoInfo } from '../../../features/daos/parameters-store'
import { AccountListItem } from '../../../widgets/account-list-item'
import { MutationError, pending } from "@reactive-dot/core";
import { useLazyLoadQuery, useMutation, useMutationEffect } from "@reactive-dot/react";
import { useAtomValue } from 'jotai'
import { selectedDaoIdAtom, useLazyLoadSelectedDaoId } from '../../../features/daos/store'
import { Binary } from 'polkadot-api'
import { AccountVote } from '../../../features/daos/components/account-vote'
import { Edit2Icon } from "lucide-react";
import { EditTokensDialog } from "../../../features/daos/components/edit-tokens-dialog";

interface FormData {
  metadata: string
  minimumSupport: string
  requiredApproval: string
  frozenTokens: boolean
}

interface EditTokenFormData {
  target: string;
  difference: bigint;
}

declare global {
  interface Window {
    signer?: {
      submitExtrinsic: (tx: unknown) => Promise<void>
    }
  }
}

export const Route = createFileRoute('/daos/_layout/settings')({
  component: DaoParametersPage,
  beforeLoad: () => ({ title: 'DAO Parameters' }),
})

function DaoParametersPage() {
  const daoId = useLazyLoadSelectedDaoId();

  if (typeof daoId !== 'number') {
    return <p>Please select or create a DAO</p>;
  }

  return <SuspendableDaoParametersPage />;

  function SuspendableDaoParametersPage() {
    const { showNotification } = useNotification()
    const [isEditing, setIsEditing] = useState(false)
    const [_isProcessing, _setIsProcessing] = useState(false)
    const selectedDaoId = useAtomValue(selectedDaoIdAtom)
    const daoInfo = useLazyLoadDaoInfo()

    // Get member addresses directly like in members.tsx
    const memberAddresses = useLazyLoadQuery((builder) =>
      builder.readStorageEntries("INV4", "CoreMembers", [selectedDaoId]),
    ).map(({ keyArgs: [_, address] }) => address);

    // Add state for editing tokens
    const [editingTokens, setEditingTokens] = useState<string | null>(null);

    // Add balance queries
    const balances = useLazyLoadQuery((builder) =>
      builder.readStorages("CoreAssets", "Accounts", memberAddresses.map(address => [address, selectedDaoId] as const))
    );

    const totalTokens = useLazyLoadQuery((builder) =>
      builder.readStorage("CoreAssets", "TotalIssuance", [selectedDaoId])
    );

    const [_editFormData, _setEditFormData] = useState<EditTokenFormData>({
      target: '',
      difference: 0n
    });

    const [tokenParams, setTokenParams] = useState<{ target: string, difference: bigint } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [_updateTokensState, updateTokens] = useMutation((tx) => {
      if (typeof selectedDaoId !== 'number') throw new Error('DAO ID not found');
      if (!tokenParams) throw new Error('No token parameters provided');

      // Max u128 value
      const MAX_U128 = 2n ** 128n - 1n;

      // Validate amount is within u128 range
      if (tokenParams.difference > MAX_U128) {
        throw new Error('Amount exceeds maximum value');
      }

      return tx.INV4.operate_multisig({
        dao_id: selectedDaoId,
        call: (tokenParams.difference > 0n
          ? tx.INV4.token_mint({
            target: tokenParams.target,
            amount: tokenParams.difference
          })
          : tx.INV4.token_burn({
            target: tokenParams.target,
            amount: tokenParams.difference < 0n ? -tokenParams.difference : tokenParams.difference
          })
        ).decodedCall,
        fee_asset: { type: "Native", value: undefined },
        metadata: undefined,
      });
    });

    // Effect to trigger mutation when tokenParams changes
    useEffect(() => {
      if (tokenParams && !isSubmitting) {
        updateTokens();
      }
    }, [tokenParams, isSubmitting, updateTokens]);

    useMutationEffect((event) => {
      if (event.value === pending) {
        setIsSubmitting(true);
        showNotification({
          variant: 'success',
          message: 'Submitting transaction...',
        });
        return;
      }

      if (event.value instanceof MutationError) {
        setIsSubmitting(false);
        setTokenParams(null);
        showNotification({
          variant: 'error',
          message: 'Transaction failed: ' + event.value.message,
        });
        return;
      }

      switch (event.value.type) {
        case 'finalized':
          setIsSubmitting(false);
          setTokenParams(null);
          if (event.value.ok) {
            showNotification({
              variant: 'success',
              message: 'Transaction submitted successfully',
            });
            setEditingTokens(null);
          } else {
            showNotification({
              variant: 'error',
              message: 'Transaction failed: ' + event.value.dispatchError.toString()
            });
          }
          break;
        default:
          showNotification({
            variant: 'success',
            message: 'Transaction pending...',
          });
      }
    });

    useEffect(() => {
      setIsEditing(false)
      if (daoInfo) {
        setFormData({
          metadata: daoInfo.metadata.asText(),
          minimumSupport: daoInfo.minimum_support.toString(),
          requiredApproval: daoInfo.required_approval.toString(),
          frozenTokens: daoInfo.frozen_tokens,
        })
      }
    }, [daoInfo])

    const [formData, setFormData] = useState<FormData>({
      metadata: '',
      minimumSupport: '',
      requiredApproval: '',
      frozenTokens: false,
    })

    const [_updateState, updateParameters] = useMutation((tx) => {
      if (!daoInfo || typeof selectedDaoId !== 'number') throw new Error('DAO info not found');

      return tx.INV4.operate_multisig({
        dao_id: selectedDaoId,
        call: tx.INV4.set_parameters({
          metadata: formData.metadata !== daoInfo.metadata.asText()
            ? Binary.fromText(formData.metadata)
            : undefined,
          minimum_support: formData.minimumSupport !== (Number(daoInfo.minimum_support) / 10_000_000).toString()
            ? Math.floor(Number(formData.minimumSupport) * 10_000_000)
            : undefined,
          required_approval: formData.requiredApproval !== (Number(daoInfo.required_approval) / 10_000_000).toString()
            ? Math.floor(Number(formData.requiredApproval) * 10_000_000)
            : undefined,
          frozen_tokens: formData.frozenTokens !== daoInfo.frozen_tokens
            ? formData.frozenTokens
            : undefined,
        }).decodedCall,
        fee_asset: { type: "Native", value: undefined },
        metadata: undefined,
      });
    });

    useMutationEffect((event) => {
      if (event.value === pending) {
        showNotification({
          variant: 'success',
          message: 'Submitting transaction...',
        });
        return;
      }

      if (event.value instanceof MutationError) {
        showNotification({
          variant: 'error',
          message: 'Transaction failed: ' + event.value.message,
        });
        return;
      }

      switch (event.value.type) {
        case 'finalized':
          if (event.value.ok) {
            showNotification({
              variant: 'success',
              message: 'Transaction submitted successfully',
            });
          } else {
            showNotification({
              variant: 'error',
              message: 'Transaction failed: ' + event.value.dispatchError.toString()
            });
          }
          break;
        default:
          showNotification({
            variant: 'success',
            message: 'Transaction pending...',
          });
      }
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        if (!daoInfo) return;

        const hasChanges =
          formData.metadata !== daoInfo.metadata.asText() ||
          formData.minimumSupport !== daoInfo.minimum_support.toString() ||
          formData.requiredApproval !== daoInfo.required_approval.toString() ||
          formData.frozenTokens !== daoInfo.frozen_tokens;

        if (!hasChanges) {
          showNotification({
            variant: 'success',
            message: 'No changes were made',
          })
          setIsEditing(false)
          return
        }

        await updateParameters();
      } catch (error) {
        showNotification({
          variant: 'error',
          message: error instanceof Error ? error.message : 'Transaction failed',
        })
      }
    }

    const isFieldModified = (field: keyof FormData) => {
      if (!daoInfo) return false;
      switch (field) {
        case 'metadata':
          return formData.metadata !== daoInfo.metadata.asText();
        case 'minimumSupport':
          return formData.minimumSupport !== daoInfo.minimum_support.toString();
        case 'requiredApproval':
          return formData.requiredApproval !== daoInfo.required_approval.toString();
        case 'frozenTokens':
          return formData.frozenTokens !== daoInfo.frozen_tokens;
      }
    };

    if (typeof selectedDaoId !== 'number' || !daoInfo) {
      return <div>Loading...</div>
    }

    return (
      <div className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
      })}>
        <div className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          flexWrap: 'wrap',
          gap: '0.5rem',
        })}>
          <div className={css({
            maxWidth: 'calc(100% - 130px)',
            overflow: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
            '--ms-overflow-style': 'none',
            '@media (max-width: 600px)': {
              maxWidth: isEditing ? '100%' : 'calc(100% - 110px)',
            },
          })}>
            <h2 className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              '@media (max-width: 600px)': {
                fontSize: '1.2rem',
              }
            })}>
              {daoInfo.metadata.asText()} Parameters
            </h2>
          </div>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className={css({
                flexShrink: 0,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                height: 'auto',
                minHeight: '2.25rem',
                whiteSpace: 'nowrap',
                '@media (max-width: 600px)': {
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.8rem',
                }
              })}
            >
              Edit Parameters
            </Button>
          )}
        </div>

        {isEditing ? (
          <form
            onSubmit={handleSubmit}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              backgroundColor: 'surfaceContainer',
              padding: '1.5rem',
              borderRadius: '0.5rem',
            })}
          >
            <div>
              <label
                className={css({
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'medium',
                })}
              >
                DAO Name
              </label>
              <input
                type="text"
                value={formData.metadata}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: e.target.value,
                  }))
                }
                placeholder={daoInfo.metadata.asText()}
                className={css({
                  width: '100%',
                  padding: '0.75em',
                  borderRadius: '0.3125em',
                  border: '1px solid token(colors.outline)',
                  backgroundColor: isFieldModified('metadata') ? 'container' : 'surface',
                  color: isFieldModified('metadata') ? 'content.primary' : 'content.muted',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    backgroundColor: 'container',
                    color: 'content.primary',
                  },
                })}
              />
            </div>

            <div>
              <label
                className={css({
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'medium',
                })}
              >
                Minimum Support (%)
              </label>
              <input
                type="number"
                value={formData.minimumSupport}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    minimumSupport: e.target.value,
                  }))
                }
                placeholder={(Number(daoInfo.minimum_support) / 10_000_000).toFixed(2)}
                className={css({
                  width: '100%',
                  padding: '0.75em',
                  borderRadius: '0.3125em',
                  border: '1px solid token(colors.outline)',
                  backgroundColor: isFieldModified('minimumSupport') ? 'container' : 'surface',
                  color: isFieldModified('minimumSupport') ? 'content.primary' : 'content.muted',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    backgroundColor: 'container',
                    color: 'content.primary',
                  },
                })}
              />
            </div>

            <div>
              <label
                className={css({
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'medium',
                })}
              >
                Required Approval (%)
              </label>
              <input
                type="number"
                value={formData.requiredApproval}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    requiredApproval: e.target.value,
                  }))
                }
                placeholder={(Number(daoInfo.required_approval) / 10_000_000).toFixed(2)}
                className={css({
                  width: '100%',
                  padding: '0.75em',
                  borderRadius: '0.3125em',
                  border: '1px solid token(colors.outline)',
                  backgroundColor: isFieldModified('requiredApproval') ? 'container' : 'surface',
                  color: isFieldModified('requiredApproval') ? 'content.primary' : 'content.muted',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    backgroundColor: 'container',
                    color: 'content.primary',
                  },
                })}
              />
            </div>

            <div>
              <label
                className={css({
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'medium',
                })}
              >
                <input
                  type="checkbox"
                  checked={formData.frozenTokens}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      frozenTokens: e.target.checked,
                    }))
                  }
                  className={css({
                    marginRight: '0.5rem',
                    opacity: isFieldModified('frozenTokens') ? 1 : 0.7,
                  })}
                />
                Frozen Tokens
                <span className={css({
                  marginLeft: '0.5rem',
                  color: 'content.muted',
                  fontSize: '0.9em',
                })}>
                  (Currently: {daoInfo.frozen_tokens ? 'Yes' : 'No'})
                </span>
              </label>
            </div>

            <div
              className={css({
                display: 'flex',
                gap: '1rem',
                marginTop: '1rem',
              })}
            >
              <Button type="submit">Submit Changes</Button>
              <Button
                onClick={() => setIsEditing(false)}
                type="button"
                className={css({
                  backgroundColor: 'surface',
                  color: 'onSurface',
                })}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: 'surfaceContainer',
            padding: '1.5rem',
            borderRadius: '0.5rem',
          })}>
            <div>
              <label className={css({ fontWeight: 'medium' })}>
                DAO Name
              </label>
              <p>{daoInfo.metadata.asText()}</p>
            </div>

            <div>
              <label className={css({ fontWeight: 'medium' })}>
                Minimum Support
              </label>
              <p>{(Number(daoInfo.minimum_support) / 10_000_000).toFixed(2)}%</p>
            </div>

            <div>
              <label className={css({ fontWeight: 'medium' })}>
                Required Approval
              </label>
              <p>{(Number(daoInfo.required_approval) / 10_000_000).toFixed(2)}%</p>
            </div>

            <div>
              <label className={css({ fontWeight: 'medium' })}>Frozen Tokens</label>
              <p>{daoInfo.frozen_tokens ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}

        <div className={css({
          backgroundColor: 'surfaceContainer',
          borderRadius: '0.5rem',
          overflowX: 'hidden',
        })}>
          <h3 className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            padding: '1.5rem',
            paddingBottom: '1rem',
          })}>
            Token Distribution
          </h3>
          <div className={css({
            overflowX: 'auto',
            width: '100%',
          })}>
            <table className={css({
              width: '100%',
              borderCollapse: 'collapse',
            })}>
              <thead>
                <tr className={css({
                  textAlign: 'left',
                  color: 'content.muted',
                  fontSize: '0.875rem',
                })}>
                  <th className={css({
                    textAlign: "left",
                    padding: "1rem",
                  })}>Account</th>
                  <th className={css({
                    textAlign: "right",
                    padding: "1rem",
                  })}>Voting Tokens</th>
                  <th className={css({
                    textAlign: "right",
                    padding: "1rem",
                  })}>Vote Strength (%)</th>
                  <th className={css({
                    textAlign: "center",
                    padding: "1rem",
                    width: "60px",
                  })}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {memberAddresses.map((address, index) => (
                  <tr
                    key={address}
                    className={css({
                      '&:hover': {
                        backgroundColor: 'surfaceHover',
                      }
                    })}
                  >
                    <td>
                      <AccountListItem address={address} />
                    </td>
                    {editingTokens === address ? (
                      <EditTokensDialog
                        address={address}
                        currentBalance={balances[index]?.free ?? 0n}
                        currentTotalTokens={totalTokens ?? 0n}
                        onClose={() => setEditingTokens(null)}
                        isSubmitting={isSubmitting}
                        onSubmit={async (difference) => {
                          if (isSubmitting) return;
                          try {
                            setTokenParams({
                              target: address,
                              difference
                            });
                          } catch (error) {
                            showNotification({
                              variant: "error",
                              message: error instanceof Error ? error.message : 'Transaction failed',
                            });
                          }
                        }}
                      />
                    ) : (
                      <>
                        <AccountVote daoId={selectedDaoId} address={address} />
                        <td className={css({
                          textAlign: "center",
                          padding: "1rem",
                          width: "100px"
                        })}>
                          <button
                            className={css({
                              color: "content.muted",
                              cursor: "pointer",
                              "&:hover": { color: "content.primary" },
                            })}
                            onClick={() => setEditingTokens(address)}
                          >
                            <Edit2Icon size={18} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
}