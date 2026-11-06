const { calculateBalances, generateSettlements, getCurrencyDecimals } = require('../utils/calculateBalances');

describe('calculateBalances', () => {
  test('Equal split between 3 members, one paid full amount', () => {
    const members = [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
      { id: '3', name: 'Charlie', email: 'charlie@example.com' }
    ];

    const expenses = [
      { amount: 300, paidBy: '1', splitAmong: ['1', '2', '3'] }
    ];

    const result = calculateBalances(expenses, members);

    // Alice paid 300, her share is 100, so she is owed 200 (balance 200)
    // Bob and Charlie each owe 100 (balance -100)
    expect(result.membersWithBalance.find(m => m.id === '1').balance).toBe(200);
    expect(result.membersWithBalance.find(m => m.id === '2').balance).toBe(-100);
    expect(result.membersWithBalance.find(m => m.id === '3').balance).toBe(-100);

    expect(result.settlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: '2', to: '1', amount: 100 }),
      expect.objectContaining({ from: '3', to: '1', amount: 100 })
    ]));
  });

  test('Two payers, unequal amounts', () => {
    const members = [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
      { id: '3', name: 'Charlie', email: 'charlie@example.com' }
    ];

    // Alice paid 300 for all 3 (everyone owes 100) -> Alice +200, Bob -100, Charlie -100
    // Bob paid 150 for all 3 (everyone owes 50) -> Alice -50, Bob +100, Charlie -50
    // Net: Alice +150, Bob 0, Charlie -150
    const expenses = [
      { amount: 300, paidBy: '1', splitAmong: ['1', '2', '3'] },
      { amount: 150, paidBy: '2', splitAmong: ['1', '2', '3'] }
    ];

    const result = calculateBalances(expenses, members);

    expect(result.membersWithBalance.find(m => m.id === '1').balance).toBe(150);
    expect(result.membersWithBalance.find(m => m.id === '2').balance).toBe(0);
    expect(result.membersWithBalance.find(m => m.id === '3').balance).toBe(-150);

    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0]).toEqual(expect.objectContaining({ from: '3', to: '1', amount: 150 }));
  });

  test('Already settled (all balances zero)', () => {
    const members = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' }
    ];

    // Alice paid 100 for Bob, Bob paid 100 for Alice
    const expenses = [
      { amount: 100, paidBy: '1', splitAmong: ['2'] },
      { amount: 100, paidBy: '2', splitAmong: ['1'] }
    ];

    const result = calculateBalances(expenses, members);

    expect(result.membersWithBalance.find(m => m.id === '1').balance).toBe(0);
    expect(result.membersWithBalance.find(m => m.id === '2').balance).toBe(0);
    expect(result.settlements).toHaveLength(0);
  });

  test('Single member trip', () => {
    const members = [
      { id: '1', name: 'Alice' }
    ];

    const expenses = [
      { amount: 100, paidBy: '1', splitAmong: ['1'] }
    ];

    const result = calculateBalances(expenses, members);

    expect(result.membersWithBalance.find(m => m.id === '1').balance).toBe(0);
    expect(result.settlements).toHaveLength(0);
  });

  test('Floating point amounts', () => {
    const members = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' }
    ];

    const expenses = [
      { amount: 100.01, paidBy: '1', splitAmong: ['1', '2', '3'] }
    ];

    const result = calculateBalances(expenses, members);

    const sum = result.membersWithBalance.reduce((acc, curr) => acc + curr.balance, 0);
    expect(sum).toBeCloseTo(0, 1);

    expect(result.settlements.length).toBeGreaterThan(0);
  });

  test('3-way split of 100.00 must sum exactly to 0 without floating-point loss', () => {
    const members = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' }
    ];

    const expenses = [
      { amount: 100.00, paidBy: '1', splitAmong: ['1', '2', '3'] }
    ];

    const result = calculateBalances(expenses, members);

    // Sum of net balances must equal 0 exactly
    const sum = result.membersWithBalance.reduce((acc, curr) => acc + curr.balance, 0);
    expect(sum).toBe(0);

    // Sum of settlements must cover exactly the owed amount (33.33 + 33.33 = 66.66)
    const settlementTotal = result.settlements.reduce((acc, s) => acc + s.amount, 0);
    expect(Math.round(settlementTotal * 100)).toBe(6666);
  });

  test('groups expenses and settlements per currency', () => {
    const members = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' }
    ];

    const expenses = [
      { amount: 100, currency: 'USD', paidBy: '1', splitAmong: ['1', '2'] },
      { amount: 200, currency: 'EUR', paidBy: '2', splitAmong: ['1', '2'] }
    ];

    const result = calculateBalances(expenses, members);
    expect(result.byCurrency).toBeDefined();
    expect(result.byCurrency.USD).toBeDefined();
    expect(result.byCurrency.EUR).toBeDefined();

    expect(result.byCurrency.USD.totalExpenses).toBe(100);
    expect(result.byCurrency.USD.balanceMap['1']).toBe(50);
    expect(result.byCurrency.USD.balanceMap['2']).toBe(-50);
    expect(result.byCurrency.USD.settlements).toEqual([
      expect.objectContaining({ from: '2', to: '1', amount: 50 })
    ]);

    expect(result.byCurrency.EUR.totalExpenses).toBe(200);
    expect(result.byCurrency.EUR.balanceMap['2']).toBe(100);
    expect(result.byCurrency.EUR.balanceMap['1']).toBe(-100);
    expect(result.byCurrency.EUR.settlements).toEqual([
      expect.objectContaining({ from: '1', to: '2', amount: 100 })
    ]);
  });

  test('sorts splits deterministically so leftover cent assignment is stable regardless of input order', () => {
    const members = [
      { id: 'u-charlie', name: 'Charlie' },
      { id: 'u-alice', name: 'Alice' },
      { id: 'u-bob', name: 'Bob' }
    ];

    const expenseUnsorted = {
      amount: 100,
      currency: 'USD',
      paidBy: 'u-alice',
      splitAmong: ['u-charlie', 'u-alice', 'u-bob']
    };

    const res1 = calculateBalances([expenseUnsorted], members);
    expect(res1.balanceMap['u-alice']).toBe(66.66);
    expect(res1.balanceMap['u-bob']).toBe(-33.33);
    expect(res1.balanceMap['u-charlie']).toBe(-33.33);
  });

  test('respects JPY currency precision (0 decimals, integer amounts)', () => {
    const members = [
      { id: 'u-1', name: 'Takeshi' },
      { id: 'u-2', name: 'Yuki' },
      { id: 'u-3', name: 'Ken' }
    ];

    // 1000 JPY split 3 ways: 1000 / 3 = 333 each with 1 remainder yen
    // Takeshi (u-1) gets 334, Yuki (u-2) gets 333, Ken (u-3) gets 333
    const expense = {
      amount: 1000,
      currency: 'JPY',
      paidBy: 'u-1',
      splitAmong: ['u-1', 'u-2', 'u-3']
    };

    const res = calculateBalances([expense], members, 'JPY');
    expect(res.currency).toBe('JPY');
    expect(res.totalExpenses).toBe(1000);
    expect(res.balanceMap['u-1']).toBe(666); // 1000 - 334
    expect(res.balanceMap['u-2']).toBe(-333);
    expect(res.balanceMap['u-3']).toBe(-333);

    // Sum of net balances in JPY must equal 0
    const sum = Object.values(res.balanceMap).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);

    // Settlements should be exact integers without decimal places
    expect(res.settlements).toHaveLength(2);
    expect(res.settlements[0].amount % 1).toBe(0);
    expect(res.settlements[1].amount % 1).toBe(0);
  });

  test('supports unequal splitting with explicit custom shares', () => {
    const members = [
      { id: 'u-1', name: 'Alice' },
      { id: 'u-2', name: 'Bob' }
    ];

    // Expense of 100 USD: Alice pays 100, but Bob consumed 70 and Alice consumed 30
    const expense = {
      amount: 100,
      currency: 'USD',
      paidBy: 'u-1',
      splits: [
        { userId: 'u-1', amount: 30 },
        { userId: 'u-2', amount: 70 }
      ]
    };

    const res = calculateBalances([expense], members, 'USD');
    expect(res.balanceMap['u-1']).toBe(70);
    expect(res.balanceMap['u-2']).toBe(-70);
    expect(res.settlements).toEqual([
      expect.objectContaining({ from: 'u-2', to: 'u-1', amount: 70 })
    ]);
  });

  test('safely ignores zero and negative expense amounts', () => {
    const members = [
      { id: 'u-1', name: 'Alice' },
      { id: 'u-2', name: 'Bob' }
    ];

    const expenses = [
      { amount: 0, paidBy: 'u-1', splitAmong: ['u-1', 'u-2'] },
      { amount: -50, paidBy: 'u-1', splitAmong: ['u-1', 'u-2'] },
      { amount: NaN, paidBy: 'u-1', splitAmong: ['u-1', 'u-2'] },
      { amount: 100, paidBy: 'u-1', splitAmong: ['u-1', 'u-2'] }
    ];

    const res = calculateBalances(expenses, members, 'USD');
    expect(res.totalExpenses).toBe(100);
    expect(res.balanceMap['u-1']).toBe(50);
    expect(res.balanceMap['u-2']).toBe(-50);
  });

  test('settlement tie-breaking is deterministic when debtors have identical amounts', () => {
    const members = [
      { id: 'user-b', name: 'Bob' },
      { id: 'user-a', name: 'Alice' },
      { id: 'user-c', name: 'Charlie' }
    ];

    // Charlie paid 200, Bob and Alice each owe 100
    const balanceMap = {
      'user-c': 20000,
      'user-b': -10000,
      'user-a': -10000
    };

    const settlements1 = generateSettlements(balanceMap, members, 'USD');
    const settlements2 = generateSettlements(balanceMap, members, 'USD');

    expect(settlements1).toEqual(settlements2);
    // user-a comes before user-b alphabetically in deterministic tie-breaking
    expect(settlements1[0].from).toBe('user-a');
    expect(settlements1[1].from).toBe('user-b');
  });
});
