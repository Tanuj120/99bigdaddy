import assert from 'node:assert/strict';
import md5 from 'md5';

process.env.SKIP_DB = 'true';

const connection = (await import('../src/config/connectDB.js')).default;
const accountController = (await import('../src/controllers/accountController.js')).default;
const authToken = 'profile-email-verification-token';

await connection.execute(
    'UPDATE users SET email = ?, token = ? WHERE phone = ?',
    ['current@example.test', authToken, '8972182034']
);
await connection.execute(
    'INSERT INTO `users` (`phone`, `email`, `password`, `veri`) VALUES (?, ?, ?, ?)',
    ['15559110000', 'existing@example.test', md5('qwert'), 1]
);

const invokeChangeEmail = async (body) => {
    const result = { statusCode: 200, body: null };
    const response = {
        status(statusCode) {
            result.statusCode = statusCode;
            return this;
        },
        json(payload) {
            result.body = payload;
            return payload;
        },
    };

    await accountController.changeEmail({
        body,
        cookies: { auth: authToken },
    }, response);

    return result;
};

const baseRequest = {
    oldEmail: 'current@example.test',
    newEmail: 'new.email@example.test',
    confirmEmail: 'new.email@example.test',
    password: 'qwert',
};

const wrongOldEmail = await invokeChangeEmail({
    ...baseRequest,
    oldEmail: 'wrong@example.test',
});
assert.equal(wrongOldEmail.body.status, false);
assert.equal(wrongOldEmail.body.message, 'Old email address does not match');

const wrongPassword = await invokeChangeEmail({
    ...baseRequest,
    password: 'incorrect',
});
assert.equal(wrongPassword.body.status, false);
assert.equal(wrongPassword.body.message, 'Incorrect password');

const mismatchedConfirmation = await invokeChangeEmail({
    ...baseRequest,
    confirmEmail: 'different@example.test',
});
assert.equal(mismatchedConfirmation.body.status, false);
assert.equal(mismatchedConfirmation.body.message, 'New email addresses do not match');

const duplicateEmail = await invokeChangeEmail({
    ...baseRequest,
    newEmail: 'existing@example.test',
    confirmEmail: 'existing@example.test',
});
assert.equal(duplicateEmail.body.status, false);
assert.equal(duplicateEmail.body.message, 'This email address is already registered');

const successfulUpdate = await invokeChangeEmail({
    ...baseRequest,
    newEmail: '  New.Email@Example.Test  ',
    confirmEmail: 'new.email@example.test',
});
assert.equal(successfulUpdate.body.status, true, successfulUpdate.body.message);
assert.equal(successfulUpdate.body.email, 'new.email@example.test');

const [updatedRows] = await connection.query(
    'SELECT email FROM users WHERE token = ?',
    [authToken]
);
assert.equal(updatedRows.length, 1);
assert.equal(updatedRows[0].email, 'new.email@example.test');

console.log('Profile email change verification passed.');
console.log('Verified identity checks, uniqueness, normalization, and persisted update.');
