function getMemberId(m) {
  if (!m) return null;
  if (typeof m === 'object') return (m.id || m._id || '').toString();
  return m.toString();
}

/**
 * Generate minimum transactions to settle all debts using minor units.
 * Debtors and creditors are sorted descending by amount before matching.
 *
 * @param {Object} minorBalanceMap - Map of userId to net balance in minor units
 * @param {Array} members - Array of member objects
 * @returns {Array} Array of settlement transactions
 */
function generateSettlements(minorBalanceMap, members) {
  const settlements = [];

  const memberMap = {};
  members.forEach(m => {
    const mId = getMemberId(m);
    if (mId) {
      memberMap[mId] = { name: m.name, email: m.email };
    }
  });

  const debtors = [];
  const creditors = [];

  Object.entries(minorBalanceMap).forEach(([userId, minorBal]) => {
    if (minorBal < 0) {
      debtors.push({ userId, amountMinor: Math.abs(minorBal) });
    } else if (minorBal > 0) {
      creditors.push({ userId, amountMinor: minorBal });
    }
  });

  // Sort debtors and creditors descending by amount
  debtors.sort((a, b) => b.amountMinor - a.amountMinor);
  creditors.sort((a, b) => b.amountMinor - a.amountMinor);

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

function calculateSingleCurrencyBalances(expenses, members) {
  const minorBalanceMap = {};
  members.forEach(member => {
    const mId = getMemberId(member);
    if (mId) minorBalanceMap[mId] = 0;
  });

  expenses.forEach(expense => {
    const rawAmount = Number(expense.amount) || 0;
    const amountMinor = Math.round(rawAmount * 100);

    const paidByUserId = getMemberId(expense.paidBy) || (expense.paidById ? expense.paidById.toString() : null);

    const rawSplits = Array.isArray(expense.splitAmong)
      ? expense.splitAmong.map(getMemberId).filter(Boolean)
      : (Array.isArray(expense.splits)
        ? expense.splits.map(s => getMemberId(s.user) || (s.userId ? s.userId.toString() : null)).filter(Boolean)
        : []);

    // Deduplicate and sort deterministically by userId
    const splitIds = Array.from(new Set(rawSplits)).sort();

    const splitCount = splitIds.length;
    if (splitCount === 0 || !paidByUserId) return;

    const baseShareMinor = Math.floor(amountMinor / splitCount);
    const remainderMinor = amountMinor - (baseShareMinor * splitCount);

    minorBalanceMap[paidByUserId] = (minorBalanceMap[paidByUserId] || 0) + amountMinor;

    splitIds.forEach((userIdStr, idx) => {
      const participantShare = baseShareMinor + (idx < remainderMinor ? 1 : 0);
      minorBalanceMap[userIdStr] = (minorBalanceMap[userIdStr] || 0) - participantShare;
    });
  });

  const balanceMap = {};
  Object.entries(minorBalanceMap).forEach(([userId, minorBal]) => {
    balanceMap[userId] = minorBal / 100;
  });

  const settlements = generateSettlements(minorBalanceMap, members);

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
 * Calculate balances for a trip's expenses grouped by currency.
 *
 * @param {Array} expenses - Array of expense objects
 * @param {Array} members - Array of member objects
 * @param {string} [defaultCurrency='INR'] - Default currency fallback
 * @returns {Object} { balanceMap, settlements, membersWithBalance, byCurrency }
 */
function calculateBalances(expenses = [], members = [], defaultCurrency = 'INR') {
  const byCurrency = {};

  if (!expenses || expenses.length === 0) {
    const single = calculateSingleCurrencyBalances([], members);
    byCurrency[defaultCurrency] = single;
    return {
      ...single,
      byCurrency
    };
  }

  // Group expenses by currency
  const currencyGroups = new Map();
  for (const exp of expenses) {
    const curr = (exp.currency || defaultCurrency || 'INR').toUpperCase();
    if (!currencyGroups.has(curr)) {
      currencyGroups.set(curr, []);
    }
    currencyGroups.get(curr).push(exp);
  }

  for (const [curr, currExpenses] of currencyGroups.entries()) {
    byCurrency[curr] = calculateSingleCurrencyBalances(currExpenses, members);
  }

  // Primary return uses first currency or default
  const primaryCurrency = currencyGroups.keys().next().value || defaultCurrency;
  const primaryResult = byCurrency[primaryCurrency];

  return {
    balanceMap: primaryResult.balanceMap,
    settlements: primaryResult.settlements,
    membersWithBalance: primaryResult.membersWithBalance,
    byCurrency
  };
}

module.exports = { calculateBalances, generateSettlements };

