export interface Member {
  address: string;
  tokens: bigint;
}

export interface TokenHolder {
  address: string;
  amount: string;
}

export interface VotingPowerCalculator {
  currentMembers: Member[];
  newMembers: Member[];
  totalTokens: bigint;
}

/**
 * Calculates the voting power distribution for both current and new members
 * @returns Object containing current and projected voting powers as percentages
 */
export function calculateVotingPower({
  currentMembers,
  newMembers,
  totalTokens,
}: VotingPowerCalculator) {
  // Calculate total tokens including new members
  const newTotalTokens = newMembers.reduce(
    (acc, member) => acc + member.tokens,
    totalTokens,
  );

  // Calculate voting power for current members
  const currentVotingPower = new Map<string, number>();
  currentMembers.forEach((member) => {
    const power = Number((member.tokens * 10000n) / totalTokens) / 100;
    currentVotingPower.set(member.address, power);
  });

  // Calculate projected voting power including new members
  const projectedVotingPower = new Map<string, number>();
  [...currentMembers, ...newMembers].forEach((member) => {
    const power = Number((member.tokens * 10000n) / newTotalTokens) / 100;
    projectedVotingPower.set(member.address, power);
  });

  return {
    currentVotingPower,
    projectedVotingPower,
    newTotalTokens,
  };
}

/**
 * Calculates the required tokens for new members to achieve equal voting power
 */
export function calculateEqualVotingPowerDistribution(
  currentTotalTokens: bigint,
  targetMemberCount: number,
): bigint {
  // Calculate tokens needed for each new member to have equal voting power
  const totalMemberCount = targetMemberCount;
  const targetVotingPower = 100 / totalMemberCount; // Equal percentage for each member

  // Calculate required tokens for new members
  // Formula: (current_total * target_percentage) / (100 - target_percentage * new_member_count)
  const tokensPerNewMember =
    (currentTotalTokens * BigInt(Math.round(targetVotingPower * 100))) /
    BigInt(
      10000 - Math.round(targetVotingPower * 100) * (targetMemberCount - 1),
    );

  return tokensPerNewMember;
}

/**
 * Calculates the total tokens from a map of token holders
 */
export function calculateTotalTokens(tokenHolders: {
  [key: string]: string;
}): bigint {
  return Object.values(tokenHolders).reduce(
    (sum, amount) => sum + BigInt(amount || "0"),
    BigInt(0),
  );
}

/**
 * Calculates voting power percentages for each token holder
 */
export function calculateVotingPowerPercentages(tokenHolders: {
  [key: string]: string;
}): { [key: string]: number } {
  const total = calculateTotalTokens(tokenHolders);

  if (total === BigInt(0)) return {};

  const powers: { [key: string]: number } = {};
  Object.entries(tokenHolders).forEach(([address, tokens]) => {
    powers[address] =
      Number((BigInt(tokens || "0") * BigInt(10000)) / total) / 100;
  });

  return powers;
}

/**
 * Distributes equal voting tokens to all members
 */
export function distributeEqualVotingTokens(
  members: string[],
  creatorAddress: string,
): { [key: string]: string } {
  const tokensPerMember = "1000000"; // 1M tokens per member
  const allMembers = [creatorAddress, ...members];

  return Object.fromEntries(
    allMembers.map((member) => [member, tokensPerMember]),
  );
}
