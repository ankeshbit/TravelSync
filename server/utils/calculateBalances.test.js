const { calculateBalances } = require('./calculateBalances');
const assert = require('assert');

describe('calculateBalances', () => {
  test('should calculate balances for a simple expense split evenly', () => {
    const expenses = [
      {
        _id: 'exp1',
        amount: 100,
        paidBy: { _id: 'user1' },
        splitAmong: [{ _id: 'user1' }, { _id: 'user2' }]
      }
    ];

    const members = [
      { _id: 'user1', name: 'Alice', email: 'alice@example.com' },
      { _id: 'user2', name: 'Bob', email: 'bob@example.com' }
    ];

    const result = calculateBalances(expenses, members);

    // Alice paid 100, splits with Bob: Alice +100, then -50 (her share) = +50
    // Bob: -50 (his share) = -50
    assert.strictEqual(result.balanceMap['user1'], 50);
    assert.strictEqual(result.balanceMap['user2'], -50);
    assert.strictEqual(result.membersWithBalance.length, 2);

    // Check settlements
    assert.strictEqual(result.settlements.length, 1);
    assert.deepStrictEqual(result.settlements[0], {
      from: 'user2',
      fromName: 'Bob',
      to: 'user1',
      toName: 'Alice',
      amount: 50
    });
  });

  test('should handle multiple expenses', () => {
    const expenses = [
      {
        _id: 'exp1',
        amount: 100,
        paidBy: { _id: 'user1' },
        splitAmong: [{ _id: 'user1' }, { _id: 'user2' }, { _id: 'user3' }]
      },
      {
        _id: 'exp2',
        amount: 60,
        paidBy: { _id: 'user2' },
        splitAmong: [{ _id: 'user1' }, { _id: 'user2' }]
      }
    ];

    const members = [
      { _id: 'user1', name: 'Alice', email: 'alice@example.com' },
      { _id: 'user2', name: 'Bob', email: 'bob@example.com' },
      { _id: 'user3', name: 'Charlie', email: 'charlie@example.com' }
    ];

    const result = calculateBalances(expenses, members);

    // Exp1: user1 pays 100, splits 3 ways: user1 +100-33.33 = +66.67, user2 -33.33, user3 -33.33
    // Exp2: user2 pays 60, splits 2 ways: user1 -30, user2 +60-30 = +30
    // Final: user1 +66.67-30 = +36.67, user2 -33.33+30 = -3.33, user3 -33.33

    const result1 = parseFloat(result.balanceMap['user1'].toFixed(2));
    const result2 = parseFloat(result.balanceMap['user2'].toFixed(2));
    const result3 = parseFloat(result.balanceMap['user3'].toFixed(2));

    assert.strictEqual(result1, 36.67);
    assert.strictEqual(result2, -3.33);
    assert.strictEqual(result3, -33.33);
  });

  test('should handle expenses with raw IDs instead of populated objects', () => {
    const expenses = [
      {
        _id: 'exp1',
        amount: 100,
        paidBy: 'user1', // raw string ID
        splitAmong: ['user1', 'user2'] // raw string IDs
      }
    ];

    const members = [
      { _id: 'user1', name: 'Alice', email: 'alice@example.com' },
      { _id: 'user2', name: 'Bob', email: 'bob@example.com' }
    ];

    const result = calculateBalances(expenses, members);

    assert.strictEqual(result.balanceMap['user1'], 50);
    assert.strictEqual(result.balanceMap['user2'], -50);
  });

  test('should skip invalid expenses with missing paidBy', () => {
    const expenses = [
      {
        _id: 'exp1',
        amount: 100,
        paidBy: null,
        splitAmong: [{ _id: 'user1' }, { _id: 'user2' }]
      }
    ];

    const members = [
      { _id: 'user1', name: 'Alice', email: 'alice@example.com' },
      { _id: 'user2', name: 'Bob', email: 'bob@example.com' }
    ];

    const result = calculateBalances(expenses, members);

    // Balances should remain zero
    assert.strictEqual(result.balanceMap['user1'], 0);
    assert.strictEqual(result.balanceMap['user2'], 0);
  });

  test('should handle zero amount expenses', () => {
    const expenses = [
      {
        _id: 'exp1',
        amount: 0,
        paidBy: { _id: 'user1' },
        splitAmong: [{ _id: 'user1' }, { _id: 'user2' }]
      }
    ];

    const members = [
      { _id: 'user1', name: 'Alice', email: 'alice@example.com' },
      { _id: 'user2', name: 'Bob', email: 'bob@example.com' }
    ];

    const result = calculateBalances(expenses, members);

    assert.strictEqual(result.balanceMap['user1'], 0);
    assert.strictEqual(result.balanceMap['user2'], 0);
  });

  test('should format balances to 2 decimal places in membersWithBalance', () => {
    const expenses = [
      {
        _id: 'exp1',
        amount: 100,
        paidBy: { _id: 'user1' },
        splitAmong: [{ _id: 'user1' }, { _id: 'user2' }, { _id: 'user3' }]
      }
    ];

    const members = [
      { _id: 'user1', name: 'Alice', email: 'alice@example.com' },
      { _id: 'user2', name: 'Bob', email: 'bob@example.com' },
      { _id: 'user3', name: 'Charlie', email: 'charlie@example.com' }
    ];

    const result = calculateBalances(expenses, members);

    const member1 = result.membersWithBalance.find(m => m._id === 'user1');
    const member2 = result.membersWithBalance.find(m => m._id === 'user2');

    // 100 / 3 = 33.333..., so user1 should be ~66.67
    assert.strictEqual(member1.balance, 66.67);
    assert.strictEqual(member2.balance, -33.33);
  });
});
