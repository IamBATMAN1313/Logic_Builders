const { Pool } = require('pg');

const pool = new Pool({
  user: 'mufti',
  password: '08235',
  host: 'localhost',
  port: 5432,
  database: 'logicbuilders'
});

module.exports = pool;
