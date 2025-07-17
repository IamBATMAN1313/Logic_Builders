const { Pool } = require('pg');

const pool = new Pool({
  user: 'rawnak',
  password: 'Rawnak1',
  host: 'localhost',
  port: 5432,
  database: 'logic'
});

module.exports = pool;
