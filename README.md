# Mini_Leave_Management_System_Anurag_Dubey

Node.js + Express + SQLite (single-file DB) MVP for employee leave management.

## Setup for the Project
1. Install dependencies:
   ```bash
   npm install

2. Run Server:

   node index.js

3. API base URL: http://localhost:3000

DB file is inside ./db/ folder.

ASSUMPTIONS

* Default annual leave: 30 days.

* Full-day leaves only.

* Leave dates are inclusive.

* New leave cannot overlap existing non-rejected leaves.

* Cannot apply before joining date.



EDGE CASES HANDLED

* Leave before joining date.

* More days than remaining balance (checked during approval).

* Overlapping or consecutive leave requests.

* Employee not found.

* Invalid dates (end date < start date).
    
    
API ENDPOINTS(examples): 

1. Add Employee

POST /api/employees

{"name":"John Doe","email":"john@example.com","department":"IT","joining_date":"2025-08-10"}


Response:

{"message":"Employee added with default leave balance","id":1}

2. Apply Leave

POST /api/leaves
{"employee_id":1,"start_date":"2025-09-10","end_date":"2025-09-12","reason":"Vacation"}

3. Approve/Reject Leave

POST /api/leaves/:id/action
{"action":"APPROVE","approver_id":99,"comment":"Approved"}

4. Get Leave Balance

GET /api/leave-balance/:employee_id


HIGH LEVEL DiAGRAM

See /diagrams folder.

POTENTIAL IMPROVEMENTS

* Authentication & roles (employee/manager/admin)

* Notifications

* Switch to PostgreSQL/MySQL for scaling

* Docker support
