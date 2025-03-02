import { selectedDaoIdAtom } from './store'
import { useLazyLoadQueryWithRefresh, useTypedApi } from '@reactive-dot/react'
import { useAtomValue } from 'jotai'
import { idle } from '@reactive-dot/core'
import { selectedAccountAtom } from '../accounts/store'
import type { SS58String } from 'polkadot-api'
import { useState, useEffect } from 'react'

// interface DaoInfo {
//     metadata: string
//     minimum_support: bigint
//     required_approval: bigint
//     frozen_tokens: boolean
// }

// interface TokenBalance {
//     free: bigint
//     reserved: bigint
//     frozen: bigint
// }

interface StorageEntry<T> {
    keyArgs: [number, SS58String]
    value: T
}

interface TokenHolder {
    account: SS58String
    balance: bigint
    percentage: number
}

export function useLazyLoadDaoInfo() {
    const account = useAtomValue(selectedAccountAtom)
    const selectedDaoId = useAtomValue(selectedDaoIdAtom)

    const [daoInfo] = useLazyLoadQueryWithRefresh((builder) =>
        account === undefined || selectedDaoId === undefined
            ? undefined
            : builder.readStorage('INV4', 'CoreStorage', [selectedDaoId])
    )

    if (!daoInfo || daoInfo === idle) {
        return undefined
    }

    return daoInfo
}

export function useLazyLoadTokenDistribution() {
    const api = useTypedApi();
    const account = useAtomValue(selectedAccountAtom)
    const selectedDaoId = useAtomValue(selectedDaoIdAtom)
    const [result, setResult] = useState<{
        totalTokens: bigint,
        holders: TokenHolder[]
    }>({
        totalTokens: 0n,
        holders: []
    });

    const [daoMembersResult] = useLazyLoadQueryWithRefresh((builder) =>
        account === undefined || selectedDaoId === undefined
            ? undefined
            : builder.readStorageEntries('INV4', 'CoreMembers', [selectedDaoId])
    )

    useEffect(() => {
        if (!daoMembersResult || daoMembersResult === idle) {
            return;
        }

        const daoMembers = (daoMembersResult as StorageEntry<never>[]).map(({ keyArgs: [_, address] }) => address);

        let totalTokens = 0n;
        const memberBalances: { account: SS58String, balance: bigint }[] = [];

        const loadBalances = async () => {
            for (const member of daoMembers) {
                const balance = await api.query.CoreAssets.Accounts.getValue(member, selectedDaoId);
                if (!balance) continue;

                const tokenBalance = balance.free;
                totalTokens += tokenBalance;
                memberBalances.push({
                    account: member,
                    balance: tokenBalance
                });
            }

            setResult({
                totalTokens,
                holders: memberBalances.map(({ account, balance }) => ({
                    account,
                    balance,
                    percentage: totalTokens === 0n ? 0 : Number((balance * 100n) / totalTokens),
                }))
            });
        };

        loadBalances().catch(console.error);
    }, [api, daoMembersResult, selectedDaoId]);

    return result;
} 