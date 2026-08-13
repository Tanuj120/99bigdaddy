import assert from 'node:assert/strict';
import {
    convertUsdtToInr,
    isValidInrDepositAmount,
    isValidUsdtDepositAmount,
} from '../src/utils/depositValidation.js';

for (const amount of [100, 101, 110, 1154, 100.5]) {
    assert.equal(isValidInrDepositAmount(amount), true, `INR ${amount} should be accepted`);
}

for (const amount of [0, 99, 99.99, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(isValidInrDepositAmount(amount), false, `INR ${amount} should be rejected`);
}

for (const amount of [1, 1.01, 1.1, 11.54]) {
    assert.equal(isValidUsdtDepositAmount(amount), true, `USDT ${amount} should be accepted`);
}

assert.equal(isValidUsdtDepositAmount(0.99), false);
assert.equal(convertUsdtToInr(1.01), 101);
assert.equal(convertUsdtToInr(11.54), 1154);

console.log('Deposit rule verification passed: normal deposits accept every amount from ₹100.');
