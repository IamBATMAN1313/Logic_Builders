
// fetch one user row by username OR email
async function getUserByUsernameOrEmail(id) {
  const { rows } = await pool.query(
    `SELECT id, username, email, password_hash
     FROM general_user
     WHERE username = $1 OR email = $1`, [id]
  );
  return rows[0];
}

// add contact_no, full_name, gender to createUser
const pool = require('../db/connection');

async function getUserByUsernameOrEmail(identifier) {
  const { rows } = await pool.query(
    `SELECT id, username, email, password_hash
     FROM general_user
     WHERE username = $1 OR email = $1`,
    [identifier]
  );
  return rows[0];
}

// now accepts contact_no, full_name, gender
async function createUser(username, email, password_hash, contact_no, full_name, gender) {
  const { rows } = await pool.query(
    `INSERT INTO general_user
       (username, email, password_hash, contact_no, full_name, gender)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, email, contact_no, full_name, gender`,
    [username, email, password_hash, contact_no, full_name, gender]
  );
  return rows[0];
}

module.exports = { getUserByUsernameOrEmail, createUser };

