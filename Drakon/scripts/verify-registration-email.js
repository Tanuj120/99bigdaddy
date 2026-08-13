import assert from 'node:assert/strict';

process.env.SKIP_DB = 'true';

const connection = (await import('../src/config/connectDB.js')).default;
const accountController = (await import('../src/controllers/accountController.js')).default;

const invokeRegister = async (body, ipSuffix) => {
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

    await accountController.register({
        body,
        headers: { 'x-forwarded-for': `10.90.0.${ipSuffix}` },
        connection: { remoteAddress: `10.90.0.${ipSuffix}` },
        socket: { remoteAddress: `10.90.0.${ipSuffix}` },
    }, response);

    assert.equal(result.statusCode, 200);
    return result.body;
};

const invalidEmail = await invokeRegister({
    username: '15559000001',
    email: 'not-an-email',
    pwd: 'qwert',
    invitecode: 'BOOTSTRAP01',
}, 1);
assert.equal(invalidEmail.status, false);
assert.equal(invalidEmail.message, 'Please enter a valid email address');

const firstRegistration = await invokeRegister({
    username: '15559000002',
    email: '  Registration.Email@Example.Test  ',
    pwd: 'qwert',
    invitecode: 'BOOTSTRAP01',
}, 2);
assert.equal(firstRegistration.status, true, firstRegistration.message);

const [firstRows] = await connection.query(
    'SELECT phone, email FROM users WHERE phone = ?',
    ['15559000002']
);
assert.equal(firstRows.length, 1);
assert.equal(firstRows[0].email, 'registration.email@example.test');

const duplicateEmail = await invokeRegister({
    username: '15559000003',
    email: 'REGISTRATION.EMAIL@EXAMPLE.TEST',
    pwd: 'qwert',
    invitecode: 'BOOTSTRAP01',
}, 3);
assert.equal(duplicateEmail.status, false);
assert.equal(duplicateEmail.message, 'Registered email address');

await connection.execute(
    'INSERT INTO `users` (`phone`, `email`, `veri`) VALUES (?, ?, ?)',
    ['15559000004', null, 0]
);
const draftCompletion = await invokeRegister({
    username: '15559000004',
    email: 'draft@example.test',
    pwd: 'qwert',
    invitecode: 'BOOTSTRAP01',
}, 4);
assert.equal(draftCompletion.status, true, draftCompletion.message);

const [draftRows] = await connection.query(
    'SELECT phone, email, veri FROM users WHERE phone = ?',
    ['15559000004']
);
assert.equal(draftRows.length, 1);
assert.equal(draftRows[0].email, 'draft@example.test');
assert.equal(Number(draftRows[0].veri), 1);

console.log('Registration email verification passed.');
console.log('Verified required format, normalization, uniqueness, persistence, and draft completion.');
