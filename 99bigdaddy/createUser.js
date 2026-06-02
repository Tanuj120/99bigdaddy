import 'dotenv/config';
import mysql from 'mysql2/promise';
import md5 from 'md5';

const PHONE = '8972182034';
const PLAIN_PASSWORD = 'qwert';

function randomNumber(min, max) {
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getDbConfig() {
  const host =
    process.env.MYSQLHOST ||
    process.env.DB_HOST ||
    process.env.DATABASE_HOST;
  const user =
    process.env.MYSQLUSER ||
    process.env.DB_USER ||
    process.env.DATABASE_USER;
  const password =
    process.env.MYSQLPASSWORD ||
    process.env.DB_PASSWORD ||
    process.env.DATABASE_PASSWORD;
  const database =
    process.env.MYSQLDATABASE ||
    process.env.DB_NAME ||
    process.env.DATABASE_NAME;
  const port = Number(
    process.env.MYSQLPORT || process.env.DB_PORT || 3306
  );

  if (!host || !user || !database) {
    throw new Error(
      'Missing DB config. Set MYSQLHOST/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE or DATABASE_* / DB_* vars.'
    );
  }

  return { host, user, password, database, port };
}

async function getInviteCode(connection) {
  const [rows] = await connection.query(
    'SELECT code FROM users WHERE code IS NOT NULL AND code != ? LIMIT 1',
    ['']
  );
  if (rows.length > 0) {
    return rows[0].code;
  }

  const bootstrapCode = 'BOOTSTRAP01';
  const now = Date.now();
  await connection.execute(
    `INSERT INTO users SET
      id_user = ?, phone = ?, name_user = ?, password = ?, plain_password = ?,
      money = ?, code = ?, invite = ?, veri = ?, status = ?, time = ?`,
    [
      randomNumber(10000, 99999),
      '1000000001',
      'Admin',
      md5('admin123'),
      'admin123',
      0,
      bootstrapCode,
      bootstrapCode,
      1,
      1,
      now,
    ]
  );
  await connection.execute('INSERT INTO point_list SET phone = ?', [
    '1000000001',
  ]);
  return bootstrapCode;
}

async function main() {
  const db = getDbConfig();
  const connection = await mysql.createConnection(db);

  try {
    const [existing] = await connection.query(
      'SELECT id, phone FROM users WHERE phone = ?',
      [PHONE]
    );

    if (existing.length > 0) {
      await connection.execute(
        'UPDATE users SET password = ?, plain_password = ?, veri = 1, status = 1 WHERE phone = ?',
        [md5(PLAIN_PASSWORD), PLAIN_PASSWORD, PHONE]
      );
      console.log(`User ${PHONE} already exists. Password updated.`);
      return;
    }

    const invitecode = await getInviteCode(connection);
    const [referrer] = await connection.query(
      'SELECT phone, level, ctv FROM users WHERE code = ? LIMIT 1',
      [invitecode]
    );

    if (referrer.length === 0) {
      throw new Error(`Referrer code not found: ${invitecode}`);
    }

    const id_user = randomNumber(10000, 99999);
    const name_user = `Member${randomNumber(10000, 99999)}`;
    const code = randomString(5) + randomNumber(10000, 99999);
    const time = Date.now();
    let ctv = '';
    if (referrer[0].level === 2) {
      ctv = referrer[0].phone;
    } else {
      ctv = referrer[0].ctv || '';
    }

    const sql = `INSERT INTO users SET
      id_user = ?, phone = ?, name_user = ?, password = ?, plain_password = ?,
      money = ?, code = ?, invite = ?, ctv = ?, veri = ?, otp = ?, ip_address = ?,
      status = ?, time = ?, free_bonus = ?, first_deposit = ?`;

    await connection.execute(sql, [
      id_user,
      PHONE,
      name_user,
      md5(PLAIN_PASSWORD),
      PLAIN_PASSWORD,
      0,
      code,
      invitecode,
      ctv,
      1,
      randomNumber(100000, 999999),
      '127.0.0.1',
      1,
      time,
      500,
      0,
    ]);

    await connection.execute('INSERT INTO point_list SET phone = ?', [PHONE]);

    console.log('User created successfully.');
    console.log({ phone: PHONE, password: PLAIN_PASSWORD, invite: invitecode, code });
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Failed to create user.');
  console.error(error.message);
  process.exit(1);
});
