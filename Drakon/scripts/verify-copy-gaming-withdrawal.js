import assert from 'node:assert/strict';

process.env.SKIP_DB = 'true';

const connection = (await import('../src/config/connectDB.js')).default;
const userController = (await import('../src/controllers/userController.js')).default;

const auth = 'copy-gaming-withdrawal-verification';
const phone = '8972182034';
const dayInMilliseconds = 86400000;

const createResponse = () => {
    const result = { statusCode: 200, body: null };
    return {
        result,
        status(statusCode) {
            result.statusCode = statusCode;
            return this;
        },
        json(body) {
            result.body = body;
            return body;
        },
    };
};

const insertDeposit = async ({ amount, days, dailyRate, startTime }) => {
    const totalInterest = Number((amount * dailyRate * days / 100).toFixed(2));
    const maturityAmount = Number((amount + totalInterest).toFixed(2));
    const maturityTime = startTime + (days * dayInMilliseconds);
    const [insertResult] = await connection.execute(
        'INSERT INTO fixed_deposits (phone, amount, tenure_days, daily_rate, total_interest, maturity_amount, status, start_time, maturity_time, withdrawn_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [phone, amount, days, dailyRate, totalInterest, maturityAmount, 'active', startTime, maturityTime, 0, startTime]
    );
    return { id: insertResult.insertId, totalInterest, maturityAmount };
};

const withdraw = async (depositId) => {
    const response = createResponse();
    await userController.withdrawFixedDeposit(
        { cookies: { auth }, body: { depositId } },
        response
    );
    assert.equal(response.result.statusCode, 200);
    return response.result.body;
};

const getBalance = async () => {
    const [rows] = await connection.query('SELECT money FROM users WHERE token = ?', [auth]);
    return Number(rows[0].money);
};

await connection.execute('UPDATE users SET token = ? WHERE phone = ?', [auth, phone]);
const openingBalance = await getBalance();

const activeDeposit = await insertDeposit({
    amount: 100,
    days: 30,
    dailyRate: 0.51,
    startTime: Date.now(),
});
const earlyWithdrawal = await withdraw(activeDeposit.id);
assert.equal(earlyWithdrawal.status, false);
assert.match(earlyWithdrawal.message, /after maturity/i);
assert.equal(await getBalance(), openingBalance);

const maturedThirtyDayDeposit = await insertDeposit({
    amount: 1000,
    days: 30,
    dailyRate: 0.51,
    startTime: Date.now() - (31 * dayInMilliseconds),
});
const thirtyDayWithdrawal = await withdraw(maturedThirtyDayDeposit.id);
assert.equal(thirtyDayWithdrawal.status, true, thirtyDayWithdrawal.message);
assert.equal(await getBalance(), Number((openingBalance + maturedThirtyDayDeposit.maturityAmount).toFixed(2)));
const thirtyDayHistory = thirtyDayWithdrawal.data.history.find((record) => Number(record.id) === maturedThirtyDayDeposit.id);
assert.equal(thirtyDayHistory.status, 'withdrawn');
assert.equal(thirtyDayHistory.tenureDays, 30);
assert.equal(thirtyDayHistory.maturityAmount, 1153);

const duplicateWithdrawal = await withdraw(maturedThirtyDayDeposit.id);
assert.equal(duplicateWithdrawal.status, false);
assert.match(duplicateWithdrawal.message, /already withdrawn/i);
assert.equal(await getBalance(), Number((openingBalance + maturedThirtyDayDeposit.maturityAmount).toFixed(2)));

const maturedNinetyDayDeposit = await insertDeposit({
    amount: 200,
    days: 90,
    dailyRate: 1.11,
    startTime: Date.now() - (91 * dayInMilliseconds),
});
const ninetyDayWithdrawal = await withdraw(maturedNinetyDayDeposit.id);
assert.equal(ninetyDayWithdrawal.status, true, ninetyDayWithdrawal.message);
assert.equal(
    await getBalance(),
    Number((openingBalance + maturedThirtyDayDeposit.maturityAmount + maturedNinetyDayDeposit.maturityAmount).toFixed(2))
);
const ninetyDayHistory = ninetyDayWithdrawal.data.history.find((record) => Number(record.id) === maturedNinetyDayDeposit.id);
assert.equal(ninetyDayHistory.status, 'withdrawn');
assert.equal(ninetyDayHistory.tenureDays, 90);
assert.equal(ninetyDayHistory.maturityAmount, 399.8);

console.log('Copy Gaming withdrawal verification passed: maturity rules, exact payouts, and duplicate protection.');
