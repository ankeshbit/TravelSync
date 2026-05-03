/**
 * Calculate balances for a trip's expenses
 * @param {Array} expenses - Array of expense objects
 * @param {Array} members - Array of member objects (with _id, name, email)
 * @returns {Object} { balanceMap, settlements, membersWithBalance }
 */
function calculateBalances(expenses, members) {
  // Initialize balance map for all members
  const balanceMap = {};
  members.forEach(member => {
    balanceMap[member._id.toString()] = 0;
  });

  // Process each expense
  expenses.forEach(expense => {
    const amount = Number(expense.amount) || 0;

    // Normalize payer id (handle populated object or raw id)
    const paidByUserId = expense.paidBy && expense.paidBy._id ? expense.paidBy._id.toString() : (expense.paidBy ? expense.paidBy.toString() : null);

    // Normalize splitAmong to an array of ids (handle populated objects)
    const splitIds = Array.isArray(expense.splitAmong)
      ? expense.splitAmong.map(u => (u && u._id) ? u._id.toString() : (u ? u.toString() : null)).filter(Boolean)
      : [];

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
    const balance = balanceMap[member._id.toString()] || 0;
    return {
      _id: member._id,
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
    memberMap[m._id.toString()] = { name: m.name, email: m.email };
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
