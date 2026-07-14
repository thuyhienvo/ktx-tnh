require('./server/load-env');
const { query } = require('./server/db');
(async () => {
  const months = (await query(`SELECT month, COUNT(*)::int c FROM invoices GROUP BY month ORDER BY month`)).rows;
  console.log('INVOICE MONTHS:', JSON.stringify(months));
  // checkout students in 2026-05 who have ANY invoice
  const rows = (await query(`
    SELECT s.id, s.name, s.check_out_date, i.month, i.days_stayed, i.total
    FROM students s JOIN invoices i ON i.student_id=s.id
    WHERE s.deleted_at IS NULL AND to_char(s.check_out_date,'YYYY-MM')='2026-05'
      AND s.checkout_confirmed_at IS NULL
    ORDER BY s.check_out_date LIMIT 15`)).rows;
  console.log('MAY-CHECKOUT w/ invoices:', JSON.stringify(rows,null,1));
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
