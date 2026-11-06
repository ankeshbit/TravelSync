function getMemberId(m) {
  if (!m) return null;
  if (typeof m === 'object') return (m.id || m._id || '').toString();
  return m.toString();
}

const CURRENCY_DECIMALS = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3
};

function getCurrencyDecimals(currency = 'INR') {
  const norm = (currency || 'INR').toUpperCase();
  return CURRENCY_DECIMALS[norm] !== undefined ? CURRENCY_DECIMALS[norm] : 2;
}

function getCurrencyFactor(currency = 'INR') {
  return Math.pow(10, getCurrencyDecimals(currency));
}

function toMinor(amount, currency = 'INR') {
  const factor = getCurrencyFactor(currency);
  return Math.round((Number(amount) || 0) * factor);
}

function toMajor(minorAmount, currency = 'INR') {
  const factor = getCurrencyFactor(currency);
  const decimals = getCurrencyDecimals(currency);
  const val = minorAmount / factor;
  return decimals === 0 ? Math.round(val) : Math.round(val * factor) / factor;
}

/**
 * Generate minimum transactions to settle all debts using minor units.
 * Debtors and creditors are sorted descending by amount with deterministic tie-breaking.
 *
 * @param {Object} minorBalanceMap - Map of userId to net balance in minor units
 * @param {Array} members - Array of member objects
 * @param {string} [currency='INR']
 * @returns {Array} Array of settlement transactions
 */
function generateSettlements(minorBalanceMap, members, currency = 'INR') {
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

  // Sort debtors and creditors descending by amount, with deterministic tie-breaking by userId
  debtors.sort((a, b) => (b.amountMinor - a.amountMinor) || a.userId.localeCompare(b.userId));
  creditors.sort((a, b) => (b.amountMinor - a.amountMinor) || a.userId.localeCompare(b.userId));

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
        amount: toMajor(transferMinor, currency)
      });

      debtor.amountMinor -= transferMinor;
      creditor.amountMinor -= transferMinor;
    }

    if (debtor.amountMinor === 0) debtorIdx++;
    if (creditor.amountMinor === 0) creditorIdx++;
  }

  return settlements;
}

function calculateSingleCurrencyBalances(expenses, members, currency = 'INR') {
  const factor = getCurrencyFactor(currency);
  const minorBalanceMap = {};
  members.forEach(member => {
    const mId = getMemberId(member);
    if (mId) minorBalanceMap[mId] = 0;
  });

  let totalExpensesMinor = 0;

  expenses.forEach(expense => {
    const rawAmount = Number(expense.amount);
    // Ignore invalid, zero, or negative amounts
    if (isNaN(rawAmount) || rawAmount <= 0) return;

    const amountMinor = toMinor(rawAmount, currency);
    totalExpensesMinor += amountMinor;

    const paidByUserId = getMemberId(expense.paidBy) || (expense.paidById ? expense.paidById.toString() : null);

    // Support both equal splits and explicit unequal splits
    let hasCustomSplits = false;
    const customSplitMap = new Map();

    if (Array.isArray(expense.splits) && expense.splits.length > 0) {
      const explicitAmounts = expense.splits.filter(s => s && s.amount !== undefined && s.amount !== null);
      if (explicitAmounts.length === expense.splits.length) {
        hasCustomSplits = true;
        expense.splits.forEach(s => {
          const uId = getMemberId(s.user) || (s.userId ? s.userId.toString() : null);
          if (uId) {
            customSplitMap.set(uId, toMinor(s.amount, currency));
          }
        });
      }
    }

    const rawSplits = Array.isArray(expense.splitAmong)
      ? expense.splitAmong.map(getMemberId).filter(Boolean)
      : (Array.isArray(expense.splits)
        ? expense.splits.map(s => getMemberId(s.user) || (s.userId ? s.userId.toString() : null)).filter(Boolean)
        : []);

    // Deduplicate and sort deterministically by userId
    const splitIds = Array.from(new Set(rawSplits)).sort();

    const splitCount = splitIds.length;
    if (splitCount === 0 || !paidByUserId) return;

    // Credit payer full amount in minor units
    minorBalanceMap[paidByUserId] = (minorBalanceMap[paidByUserId] || 0) + amountMinor;

    if (hasCustomSplits && customSplitMap.size > 0) {
      // Unequal split: verify sum of shares
      let customSumMinor = 0;
      splitIds.forEach(id => {
        customSumMinor += (customSplitMap.get(id) || 0);
      });
      // Distribute any rounding discrepancy deterministically to first sorted participant
      const discrepancy = amountMinor - customSumMinor;
      splitIds.forEach((userIdStr, idx) => {
        let participantShare = customSplitMap.get(userIdStr) || 0;
        if (idx === 0) {
          participantShare += discrepancy;
        }
        minorBalanceMap[userIdStr] = (minorBalanceMap[userIdStr] || 0) - participantShare;
      });
    } else {
      // Equal split with deterministic remainder distribution
      const baseShareMinor = Math.floor(amountMinor / splitCount);
      const remainderMinor = amountMinor - (baseShareMinor * splitCount);

      splitIds.forEach((userIdStr, idx) => {
        const participantShare = baseShareMinor + (idx < remainderMinor ? 1 : 0);
        minorBalanceMap[userIdStr] = (minorBalanceMap[userIdStr] || 0) - participantShare;
      });
    }
  });

  const totalExpenses = toMajor(totalExpensesMinor, currency);

  const balanceMap = {};
  Object.entries(minorBalanceMap).forEach(([userId, minorBal]) => {
    balanceMap[userId] = toMajor(minorBal, currency);
  });

  const settlements = generateSettlements(minorBalanceMap, members, currency);

  const membersWithBalance = members.map(member => {
    const mId = getMemberId(member);
    const balanceMinor = minorBalanceMap[mId] || 0;
    return {
      id: mId,
      _id: mId,
      name: member.name,
      email: member.email,
      balance: toMajor(balanceMinor, currency)
    };
  });

  return {
    totalExpenses,
    balanceMap,
    settlements,
    membersWithBalance,
    currency
  };
}

/**
 * Calculate balances for a trip's expenses grouped by currency.
 *
 * @param {Array} expenses - Array of expense objects
 * @param {Array} members - Array of member objects
 * @param {string} [defaultCurrency='INR'] - Default currency fallback
 * @returns {Object} { balanceMap, settlements, membersWithBalance, currency, byCurrency }
 */
function calculateBalances(expenses = [], members = [], defaultCurrency = 'INR') {
  const normDefault = (defaultCurrency || 'INR').toUpperCase();
  const byCurrency = {};

  if (!expenses || expenses.length === 0) {
    const single = calculateSingleCurrencyBalances([], members, normDefault);
    byCurrency[normDefault] = single;
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
    byCurrency[curr] = calculateSingleCurrencyBalances(currExpenses, members, curr);
  }

  // Primary return uses first currency or default
  const primaryCurrency = currencyGroups.keys().next().value || normDefault;
  const primaryResult = byCurrency[primaryCurrency];

  return {
    totalExpenses: primaryResult.totalExpenses,
    balanceMap: primaryResult.balanceMap,
    settlements: primaryResult.settlements,
    membersWithBalance: primaryResult.membersWithBalance,
    currency: primaryCurrency,
    byCurrency
  };
}

module.exports = {
  calculateBalances,
  generateSettlements,
  getCurrencyDecimals,
  getCurrencyFactor,
  toMinor,
  toMajor
};
