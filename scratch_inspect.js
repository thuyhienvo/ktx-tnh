require('./server/load-env');
const { query } = require('./server/db');
(async () => {
  const id = process.argv[2] || '1017';
  const s = (await query('SELECT id,name,room_id,status,check_out_date,checkout_actual_date,checkout_confirmed_at FROM students WHERE id=$1',[id])).rows[0];
  console.log('STUDENT:', JSON.stringify(s));
  const inv = (await query('SELECT id,month,days_stayed,room_charge,electric_charge,total FROM invoices WHERE student_id=$1 ORDER BY month',[id])).rows;
  console.log('INVOICES:', JSON.stringify(inv));
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
