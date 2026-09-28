function getMemberId(m) {
  if (!m) return null;
  if (typeof m === 'object') return (m.id || m._id || '').toString();
  return m.toString();
}

/**
 * Calculate balances for a trip's expenses
 * @param {Array} expenses - Array of expense objects
 * @param {Array} members - Array of member objects (with id/_id, name, email)
 * @returns {Object} { balanceMap, settlements, membersWithBalance }
 */
function calculateBalances(expenses, members) {
  // Initialize balance map for all members
  const balanceMap = {};
  members.forEach(member => {
    const mId = getMemberId(member);
    if (mId) balanceMap[mId] = 0;
  });

  // Process each expense
  expenses.forEach(expense => {
    const amount = Number(expense.amount) || 0;

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

    const sharePerPerson = amount / splitCount;

    // Payer's balance increases (they are owed the total amount)
    balanceMap[paidByUserId] = (balanceMap[paidByUserId] || 0) + amount;

    // Each split member's balance decreases (they owe their share)
    splitIds.forEach(userIdStr => {
      balanceMap[userIdStr] = (balanceMap[userIdStr] || 0) - sharePerPerson;
    });
  });

  // Generate settlements array (minimum transactions needed)
  const settlements = generateSettlements(balanceMap, members);

  // Build members with balance info
  const membersWithBalance = members.map(member => {
    const mId = getMemberId(member);
    const balance = balanceMap[mId] || 0;
    return {
      id: mId,
      _id: mId,
      name: member.name,
      email: member.email,
      balance: parseFloat(balance.toFixed(2))
    };
  });

  return {
    balanceMap,
    settlements,
    membersWithBalance
  };
}

/**
 * Generate minimum transactions to settle all debts
 * @param {Object} balanceMap - Map of userId to net balance
 * @param {Array} members - Array of member objects
 * @returns {Array} Array of settlement transactions
 */
function generateSettlements(balanceMap, members) {
  const settlements = [];

  // Create a copy of balance map for manipulation
  const balances = { ...balanceMap };

  // Create member id to name/email mapping
  const memberMap = {};
  members.forEach(m => {
    const mId = getMemberId(m);
    if (mId) {
      memberMap[mId] = { name: m.name, email: m.email };
    }
  });

  // Debtors (negative balance) and creditors (positive balance)
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([userId, balance]) => {
    const amount = Math.abs(balance);
    if (amount > 0.01) { // Ignore very small amounts due to rounding
      if (balance < 0) {
        debtors.push({ userId, amount });
      } else {
        creditors.push({ userId, amount });
      }
    }
  });

  // Match debtors with creditors
  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      from: debtor.userId,
      fromName: memberMap[debtor.userId]?.name || 'Unknown',
      to: creditor.userId,
      toName: memberMap[creditor.userId]?.name || 'Unknown',
      amount: parseFloat(transferAmount.toFixed(2))
    });

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount < 0.01) debtorIdx++;
    if (creditor.amount < 0.01) creditorIdx++;
  }

  return settlements;
}

module.exports = { calculateBalances };
