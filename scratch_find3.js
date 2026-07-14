require('./server/load-env');
const { query } = require('./server/db');
(async () => {
  const rows = (await query(`
    SELECT s.id, s.name, s.room_id, s.check_out_date, s.status,
           i.id inv_id, i.days_stayed, i.total, i.room_charge, i.electric_charge
    FROM students s JOIN invoices i ON i.student_id=s.id AND i.month='2026-07'
    WHERE s.deleted_at IS NULL AND to_char(s.check_out_date,'YYYY-MM')='2026-07'
      AND s.checkout_confirmed_at IS NULL
    ORDER BY s.check_out_date LIMIT 8`)).rows;
  console.log(JSON.stringify(rows,null,1));
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
