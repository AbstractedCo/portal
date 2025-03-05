import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '../../../components/button'
import { css } from '../../../../styled-system/css'
import { useNotification } from '../../../contexts/notification-context'
import { useLazyLoadDaoInfo, useLazyLoadTokenDistribution } from '../../../features/daos/parameters-store'
import { AccountListItem } from '../../../widgets/account-list-item'
import { MutationError, pending } from "@reactive-dot/core";
import { useMutation, useMutationEffect } from "@reactive-dot/react";
import { useAtomValue } from 'jotai'
import { selectedDaoIdAtom, useLazyLoadSelectedDaoId } from '../../../features/daos/store'
import { Binary } from 'polkadot-api'

interface FormData {
  metadata: string
  minimumSupport: string
  requiredApproval: string
  frozenTokens: boolean
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
    const [_isProcessing, setIsProcessing] = useState(false)
    const selectedDaoId = useAtomValue(selectedDaoIdAtom)
    const daoInfo = useLazyLoadDaoInfo()
    const { totalTokens, holders: tokenHolders } = useLazyLoadTokenDistribution()
    const [formData, setFormData] = useState<FormData>({
      metadata: '',
      minimumSupport: '',
      requiredApproval: '',
      frozenTokens: false,
    })

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

    const [_updateState, updateParameters] = useMutation((tx) => {
      if (!daoInfo || typeof selectedDaoId !== 'number') throw new Error('DAO info not found');

      return tx.INV4.operate_multisig({
        dao_id: selectedDaoId,
        call: tx.INV4.set_parameters({
          metadata: formData.metadata !== daoInfo.metadata.asText()
            ? Binary.fromText(formData.metadata)
            : undefined,
          minimum_support: formData.minimumSupport !== daoInfo.minimum_support.toString()
            ? Number(formData.minimumSupport)
            : undefined,
          required_approval: formData.requiredApproval !== daoInfo.required_approval.toString()
            ? Number(formData.requiredApproval)
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
      setIsProcessing(true);

      if (event.value === pending) {
        showNotification({
          variant: 'success',
          message: 'Submitting parameter changes...',
        });
        return;
      }

      if (event.value instanceof MutationError) {
        setIsProcessing(false);
        showNotification({
          variant: 'error',
          message: 'Failed to submit parameter changes',
        });
        return;
      }

      switch (event.value.type) {
        case 'finalized':
          setIsProcessing(false);
          if (event.value.ok) {
            showNotification({
              variant: 'success',
              message: 'Parameter change proposal submitted successfully',
            });
            setIsEditing(false);
          } else {
            showNotification({
              variant: 'error',
              message: 'Transaction failed',
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

        // Check if any changes were made
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
          message: error instanceof Error ? error.message : 'Failed to submit parameter changes',
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
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          padding: '1rem',
        })}
      >
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <h2 className={css({ fontSize: '1.5rem', fontWeight: 'bold' })}>
            {daoInfo.metadata.asText()} Parameters
          </h2>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>Edit Parameters</Button>
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
                Minimum Support
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
                placeholder={daoInfo.minimum_support.toString()}
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
                Required Approval
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
                placeholder={daoInfo.required_approval.toString()}
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
          <div
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
              <label className={css({ fontWeight: 'medium' })}>
                DAO Name
              </label>
              <p>{daoInfo.metadata.asText()}</p>
            </div>

            <div>
              <label className={css({ fontWeight: 'medium' })}>
                Minimum Support
              </label>
              <p>{daoInfo.minimum_support.toString()}</p>
            </div>

            <div>
              <label className={css({ fontWeight: 'medium' })}>
                Required Approval
              </label>
              <p>{daoInfo.required_approval.toString()}</p>
            </div>

            <div>
              <label className={css({ fontWeight: 'medium' })}>Frozen Tokens</label>
              <p>{daoInfo.frozen_tokens ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}

        <div
          className={css({
            backgroundColor: 'surfaceContainer',
            padding: '1.5rem',
            borderRadius: '0.5rem',
          })}
        >
          <h3
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
            })}
          >
            Token Distribution
          </h3>
          <p className={css({ marginBottom: '1rem' })}>
            Total Voting Tokens: {totalTokens.toString()}
          </p>
          <table className={css({
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '0 0.5rem',
          })}>
            <thead>
              <tr className={css({
                textAlign: 'left',
                color: 'content.muted',
                fontSize: '0.875rem',
              })}>
                <th className={css({ paddingBottom: '0.5rem' })}>Account</th>
                <th className={css({ paddingBottom: '0.5rem' })}>Voting Tokens</th>
                <th className={css({ paddingBottom: '0.5rem', textAlign: 'right' })}>Vote in %</th>
              </tr>
            </thead>
            <tbody>
              {tokenHolders.map((holder) => (
                <tr
                  key={holder.account}
                  className={css({
                    backgroundColor: 'surface',
                    borderRadius: '0.25rem',
                  })}
                >
                  <td className={css({
                    padding: '0.5rem',
                    borderTopLeftRadius: '0.25rem',
                    borderBottomLeftRadius: '0.25rem',
                  })}>
                    <AccountListItem address={holder.account} />
                  </td>
                  <td className={css({
                    padding: '0.5rem',
                  })}>
                    {holder.balance.toString()}
                  </td>
                  <td className={css({
                    padding: '0.5rem',
                    textAlign: 'right',
                    borderTopRightRadius: '0.25rem',
                    borderBottomRightRadius: '0.25rem',
                  })}>
                    {holder.percentage.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
}