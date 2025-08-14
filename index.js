const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Connect to SQLite
const db = new sqlite3.Database('./lms.db', (err) => { // ✅ Using lms.db
  if (err) console.error('Error opening database:', err.message);
  else console.log('Connected to SQLite database');
});

// 1️⃣ Add Employee
app.post('/api/employees', (req, res) => {
  const { name, email, department, joining_date } = req.body;
  if (!name || !email || !department || !joining_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.serialize(() => {
    db.run(
      `INSERT INTO employees (name, email, department, joining_date) VALUES (?, ?, ?, ?)`,
      [name, email, department, joining_date],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const employeeId = this.lastID;
        const year = new Date(joining_date).getFullYear();
        const defaultEntitlement = 30;

        db.run(
          `INSERT INTO leave_balances (employee_id, year, entitlement, used) VALUES (?, ?, ?, 0)`,
          [employeeId, year, defaultEntitlement],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
              message: 'Employee added with default leave balance',
              id: employeeId
            });
          }
        );
      }
    );
  });
});

// 2️⃣ Apply Leave
app.post('/api/leaves', (req, res) => {
  console.log("✅ Apply Leave route triggered");
  const { employee_id, start_date, end_date, reason } = req.body;
  if (!employee_id || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const startOnly = new Date(start_date + 'T00:00:00');
  const endOnly = new Date(end_date + 'T00:00:00');

  if (isNaN(startOnly) || isNaN(endOnly)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  if (endOnly < startOnly) {
    return res.status(400).json({ error: 'End date cannot be before start date' });
  }

  const days = Math.floor((endOnly - startOnly) / (1000 * 60 * 60 * 24)) + 1;

  db.get(`SELECT * FROM employees WHERE id = ?`, [employee_id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const joiningDateOnly = new Date(employee.joining_date + 'T00:00:00');
    if (startOnly < joiningDateOnly) {
      return res.status(400).json({ error: 'Cannot apply leave before joining date' });
    }

    db.get(
      `SELECT * FROM leaves 
       WHERE employee_id = ? 
       AND status != 'REJECTED'
       AND (
         (start_date <= ? AND end_date >= ?)  
         OR (start_date <= ? AND end_date >= ?)  
         OR (start_date >= ? AND end_date <= ?)  
       )`,
      [
        employee_id,
        start_date, start_date,
        end_date, end_date,
        start_date, end_date
      ],
      (err, overlap) => {
        if (err) return res.status(500).json({ error: err.message });
        if (overlap) {
          return res.status(400).json({ error: 'Overlapping leave request exists' });
        }

        db.run(
          `INSERT INTO leaves (employee_id, start_date, end_date, reason, days, status) 
           VALUES (?, ?, ?, ?, ?, 'PENDING')`,
          [employee_id, start_date, end_date, reason, days],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Leave applied successfully', id: this.lastID, days });
          }
        );
      }
    );
  });
});

// 3️⃣ Approve/Reject Leave
app.post('/api/leaves/:id/action', (req, res) => {
  const { id: leave_id } = req.params;
  const { action, approver_id, comment } = req.body;
  if (!action || !approver_id) {
    return res.status(400).json({ error: 'Action and approver_id are required' });
  }

  db.get(`SELECT * FROM leaves WHERE id = ?`, [leave_id], (err, leaveRecord) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!leaveRecord) return res.status(404).json({ error: 'Leave not found' });
    if (leaveRecord.status !== 'PENDING') {
      return res.status(400).json({ error: 'Leave is not pending' });
    }

    db.get(
      `SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?`,
      [leaveRecord.employee_id, new Date(leaveRecord.start_date).getFullYear()],
      (err, balance) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!balance) return res.status(404).json({ error: 'Leave balance not found' });

        db.serialize(() => {
          if (action.toUpperCase() === 'APPROVE') {
            if (balance.entitlement - balance.used < leaveRecord.days) {
              return res.status(400).json({ error: 'Insufficient balance' });
            }

            db.run(
              `UPDATE leaves 
               SET status='APPROVED', approved_by=?, approved_at=datetime('now'), approval_comment=? 
               WHERE id=?`,
              [approver_id, comment, leave_id],
              function (err) {
                if (err) return res.status(500).json({ error: err.message });

                db.run(
                  `UPDATE leave_balances SET used = used + ? WHERE id=?`,
                  [leaveRecord.days, balance.id],
                  function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Leave approved successfully' });
                  }
                );
              }
            );
          } else if (action.toUpperCase() === 'REJECT') {
            db.run(
              `UPDATE leaves 
               SET status='REJECTED', approved_by=?, approved_at=datetime('now'), approval_comment=? 
               WHERE id=?`,
              [approver_id, comment, leave_id],
              function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Leave rejected successfully' });
              }
            );
          } else {
            return res.status(400).json({ error: 'Invalid action' });
          }
        });
      }
    );
  });
});

// 4️⃣ Fetch Leave Balance
app.get('/api/leave-balance/:employee_id', (req, res) => {
  const { employee_id } = req.params;

  db.get(
    `SELECT * FROM leave_balances WHERE employee_id = ?`,
    [employee_id],
    (err, balance) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!balance) return res.status(404).json({ error: 'Leave balance not found' });
      res.json(balance);
    }
  );
});

// Start Server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
