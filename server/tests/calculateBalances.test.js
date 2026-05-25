const { calculateBalances } = require('../utils/calculateBalances');

describe('calculateBalances', () => {
  test('Equal split between 3 members, one paid full amount', () => {
    const members = [
      { _id: '1', name: 'Alice', email: 'alice@example.com' },
      { _id: '2', name: 'Bob', email: 'bob@example.com' },
      { _id: '3', name: 'Charlie', email: 'charlie@example.com' }
    ];
    
    const expenses = [
      { amount: 300, paidBy: '1', splitAmong: ['1', '2', '3'] }
    ];

    const result = calculateBalances(expenses, members);
    
    // Alice paid 300, her share is 100, so she is owed 200 (balance 200)
    // Bob and Charlie each owe 100 (balance -100)
    expect(result.membersWithBalance.find(m => m._id === '1').balance).toBe(200);
    expect(result.membersWithBalance.find(m => m._id === '2').balance).toBe(-100);
    expect(result.membersWithBalance.find(m => m._id === '3').balance).toBe(-100);
    
    expect(result.settlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: '2', to: '1', amount: 100 }),
      expect.objectContaining({ from: '3', to: '1', amount: 100 })
    ]));
  });

  test('Two payers, unequal amounts', () => {
    const members = [
      { _id: '1', name: 'Alice', email: 'alice@example.com' },
      { _id: '2', name: 'Bob', email: 'bob@example.com' },
      { _id: '3', name: 'Charlie', email: 'charlie@example.com' }
    ];
    
    // Alice paid 300 for all 3 (everyone owes 100) -> Alice +200, Bob -100, Charlie -100
    // Bob paid 150 for all 3 (everyone owes 50) -> Alice -50, Bob +100, Charlie -50
    // Net: Alice +150, Bob 0, Charlie -150
    const expenses = [
      { amount: 300, paidBy: '1', splitAmong: ['1', '2', '3'] },
      { amount: 150, paidBy: '2', splitAmong: ['1', '2', '3'] }
    ];

    const result = calculateBalances(expenses, members);
    
    expect(result.membersWithBalance.find(m => m._id === '1').balance).toBe(150);
    expect(result.membersWithBalance.find(m => m._id === '2').balance).toBe(0);
    expect(result.membersWithBalance.find(m => m._id === '3').balance).toBe(-150);
    
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0]).toEqual(expect.objectContaining({ from: '3', to: '1', amount: 150 }));
  });

  test('Already settled (all balances zero)', () => {
    const members = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' }
    ];
    
    // Alice paid 100 for Bob, Bob paid 100 for Alice
    const expenses = [
      { amount: 100, paidBy: '1', splitAmong: ['2'] },
      { amount: 100, paidBy: '2', splitAmong: ['1'] }
    ];

    const result = calculateBalances(expenses, members);
    
    expect(result.membersWithBalance.find(m => m._id === '1').balance).toBe(0);
    expect(result.membersWithBalance.find(m => m._id === '2').balance).toBe(0);
    expect(result.settlements).toHaveLength(0);
  });

  test('Single member trip', () => {
    const members = [
      { _id: '1', name: 'Alice' }
    ];
    
    const expenses = [
      { amount: 100, paidBy: '1', splitAmong: ['1'] }
    ];

    const result = calculateBalances(expenses, members);
    
    expect(result.membersWithBalance.find(m => m._id === '1').balance).toBe(0);
    expect(result.settlements).toHaveLength(0);
  });

  test('Floating point amounts', () => {
    const members = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
      { _id: '3', name: 'Charlie' }
    ];
    
    // 100.01 split among 3 -> 33.33666... per person
    // Alice balance: 100.01 - 33.33666... = 66.67333... -> 66.67
    // Bob and Charlie: -33.33666... -> -33.34
    // Note: Due to floating point math, settlements might resolve slightly differently, 
    // but the final amount should match close to two decimals.
    const expenses = [
      { amount: 100.01, paidBy: '1', splitAmong: ['1', '2', '3'] }
    ];

    const result = calculateBalances(expenses, members);
    
    const sum = result.membersWithBalance.reduce((acc, curr) => acc + curr.balance, 0);
    // Floating point might cause a .01 discrepancy, but should be close to 0
    expect(sum).toBeCloseTo(0, 1);
    
    expect(result.settlements.length).toBeGreaterThan(0);
  });
});
