function getMemberId(m) {
  if (!m) return null;
  if (typeof m === 'object') return (m.id || m._id || '').toString();
  return m.toString();
}

/**
 * Calculate balances for a trip's expenses using integer minor units (paise/cents)
 * to avoid floating-point drift, rounding only at the edges.
 *
 * @param {Array} expenses - Array of expense objects
 * @param {Array} members - Array of member objects (with id/_id, name, email)
 * @returns {Object} { balanceMap, settlements, membersWithBalance }
 */
function calculateBalances(expenses, members) {
  // Initialize balance map in integer minor units (e.g. cents/paise)
  const minorBalanceMap = {};
  members.forEach(member => {
    const mId = getMemberId(member);
    if (mId) minorBalanceMap[mId] = 0;
  });

  // Process each expense in integer minor units
  expenses.forEach(expense => {
    const rawAmount = Number(expense.amount) || 0;
    const amountMinor = Math.round(rawAmount * 100);

    // Normalize payer id (handle user object or raw id)
    const paidByUserId = getMemberId(expense.paidBy) || (expense.paidById ? expense.paidById.toString() : null);

    // Normalize splitAmong to an array of ids (handle user objects or strings)
    const splitIds = Array.isArray(expense.splitAmong)
      ? expense.splitAmong.map(getMemberId).filter(Boolean)
      : (Array.isArray(expense.splits)
        ? expense.splits.map(s => getMemberId(s.user) || (s.userId ? s.userId.toString() : null)).filter(Boolean)
        : []);

    const splitCount = splitIds.length;
    if (splitCount === 0 || !paidByUserId) return; // Skip if invalid

    // Base share and remainder distributed evenly to ensure total sum equals amountMinor exactly
    const baseShareMinor = Math.floor(amountMinor / splitCount);
    const remainderMinor = amountMinor - (baseShareMinor * splitCount);

    // Payer's balance increases by total amount in minor units
    minorBalanceMap[paidByUserId] = (minorBalanceMap[paidByUserId] || 0) + amountMinor;

    // Each participant owes their share
    splitIds.forEach((userIdStr, idx) => {
      const participantShare = baseShareMinor + (idx < remainderMinor ? 1 : 0);
      minorBalanceMap[userIdStr] = (minorBalanceMap[userIdStr] || 0) - participantShare;
    });
  });

  // Convert minor balances back to currency units (2 decimal places)
  const balanceMap = {};
  Object.entries(minorBalanceMap).forEach(([userId, minorBal]) => {
    balanceMap[userId] = minorBal / 100;
  });

  // Generate settlements array using minor units
  const settlements = generateSettlements(minorBalanceMap, members);

  // Build members with balance info
  const membersWithBalance = members.map(member => {
    const mId = getMemberId(member);
    const balanceMinor = minorBalanceMap[mId] || 0;
    return {
      id: mId,
      _id: mId,
      name: member.name,
      email: member.email,
      balance: balanceMinor / 100
    };
  });

  return {
    balanceMap,
    settlements,
    membersWithBalance
  };
}

/**
 * Generate minimum transactions to settle all debts using minor units
 * @param {Object} minorBalanceMap - Map of userId to net balance in minor units
 * @param {Array} members - Array of member objects
 * @returns {Array} Array of settlement transactions
 */
function generateSettlements(minorBalanceMap, members) {
  const settlements = [];

  // Create member id to name/email mapping
  const memberMap = {};
  members.forEach(m => {
    const mId = getMemberId(m);
    if (mId) {
      memberMap[mId] = { name: m.name, email: m.email };
    }
  });

  // Debtors (negative balance) and creditors (positive balance) in minor units
  const debtors = [];
  const creditors = [];

  Object.entries(minorBalanceMap).forEach(([userId, minorBal]) => {
    if (minorBal < 0) {
      debtors.push({ userId, amountMinor: Math.abs(minorBal) });
    } else if (minorBal > 0) {
      creditors.push({ userId, amountMinor: minorBal });
    }
  });

  // Match debtors with creditors greedily
  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    const transferMinor = Math.min(debtor.amountMinor, creditor.amountMinor);

    if (transferMinor > 0) {
      settlements.push({
        from: debtor.userId,
        fromName: memberMap[debtor.userId]?.name || 'Unknown',
        to: creditor.userId,
        toName: memberMap[creditor.userId]?.name || 'Unknown',
        amount: transferMinor / 100
      });

      debtor.amountMinor -= transferMinor;
      creditor.amountMinor -= transferMinor;
    }

    if (debtor.amountMinor === 0) debtorIdx++;
    if (creditor.amountMinor === 0) creditorIdx++;
  }

  return settlements;
}

module.exports = { calculateBalances };

