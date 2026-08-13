import assert from 'node:assert/strict';
import md5 from 'md5';

process.env.SKIP_DB = 'true';

const connection = (await import('../src/config/connectDB.js')).default;
const accountController = (await import('../src/controllers/accountController.js')).default;
const legacyAuth = 'legacy-email-setup-token';

await connection.execute(
    'UPDATE users SET email = ?, token = ? WHERE phone = ?',
    [null, legacyAuth, '8972182034']
);
await connection.execute(
    'INSERT INTO `users` (`phone`, `email`, `password`, `veri`) VALUES (?, ?, ?, ?)',
    ['15559220000', 'taken@example.test', md5('qwert'), 1]
);

const invokeSetup = async (body) => {
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

    await accountController.setInitialEmail({
        body,
        cookies: { auth: legacyAuth },
    }, response);
    return result;
};

const mismatched = await invokeSetup({
    email: 'legacy@example.test',
    confirmEmail: 'different@example.test',
});
assert.equal(mismatched.body.status, false);
assert.equal(mismatched.body.message, 'Email addresses do not match');

const duplicate = await invokeSetup({
    email: 'taken@example.test',
    confirmEmail: 'taken@example.test',
});
assert.equal(duplicate.body.status, false);
assert.equal(duplicate.body.message, 'This email address is already registered');

const successful = await invokeSetup({
    email: '  Legacy.User@Example.Test  ',
    confirmEmail: 'legacy.user@example.test',
});
assert.equal(successful.body.status, true, successful.body.message);
assert.equal(successful.body.email, 'legacy.user@example.test');

const [savedRows] = await connection.query(
    'SELECT email FROM users WHERE token = ?',
    [legacyAuth]
);
assert.equal(savedRows[0].email, 'legacy.user@example.test');

const secondSetup = await invokeSetup({
    email: 'second@example.test',
    confirmEmail: 'second@example.test',
});
assert.equal(secondSetup.body.status, false);
assert.equal(secondSetup.body.redirect, '/myProfile/email');

const pageResult = { view: '', data: null, redirect: '' };
await accountController.changeEmailPage(
    { cookies: { auth: legacyAuth } },
    {
        render(view, data) {
            pageResult.view = view;
            pageResult.data = data;
        },
        redirect(path) {
            pageResult.redirect = path;
        },
    }
);
assert.equal(pageResult.view, 'member/changeEmail.ejs');
assert.equal(pageResult.data.currentEmail, 'legacy.user@example.test');

console.log('Legacy email setup verification passed.');
console.log('Verified first-time setup, uniqueness, persistence, and edit-page transition.');
