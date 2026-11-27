# School Office Appointment Queue System

A web-based queue system for school offices. Students pick an office, get a queue ticket, and watch their position in line. Staff call, serve, skip, and transfer tickets from their own dashboard. Both dashboards update in real time.

**Subject:** Event-Driven Programming  **Section:** BSIT-3C

## Team

| Member | Role |
|---|---|
| Rogelito Jr C. Maderal | Frontend Developer |
| Jerome R. Martinez | Backend Developer |

## Features

- **Login** with show/hide password and role-based redirect (Student or Staff)
- **Student dashboard:** get a queue ticket, see the queue number, position, estimated wait, and ticket status, cancel a ticket, and view recent activity
- **Staff dashboard:** summary cards, a live queue table, and the actions Call Next, Serve, Skip, and Transfer
- **Now Serving display** for each office
- **Queue History** with search, date filter, pagination, details, and CSV export
- **Reports and Analytics** with Chart.js charts
- **Notifications** with toasts and a badge for called, two-away, served, skipped, and transferred tickets
- **Real-time updates** between student and staff screens with Socket.IO
- **Responsive layout** for desktop, tablet, and mobile

## Technologies
 
| Layer | Tools |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript, Lucide Icons, Chart.js |
| Backend | Node.js, Express.js |
| Database | SQLite (`sqlite3`) |
| Real time | Socket.IO (WebSocket) |
| Security | `bcryptjs` password hashing, `express-session` |
 
## How to Run
 
### Requirements
 
- Node.js version 18 or newer
- A modern web browser
- An internet connection (the icons and charts load from a CDN)
### Steps
 
1. Download or clone the project and open a terminal in the project folder (the one that contains `package.json`).
2. Install the dependencies:
```bash / terminal
npm install
```
 
3. Start the server:
```bash / terminal
node server.js
```
 
4. Open **http://localhost:3000** in your browser.
The first time the server starts, it creates the SQLite database file (`school_queue.db`) and the two demo accounts automatically. Stop the server with `Ctrl + C`.
 
## Demo Accounts
 
| Role | Username | Password |
|---|---|---|
| Student | `student` | `student123` |
| Staff | `staff` | `staff123` |
 
You can also sign in with the email: `student@school.edu` or `staff@school.edu`.
 
## How to Use
 
### As a Student
 
1. Sign in with the **Student** demo account. You are sent to the student dashboard.
2. Open **Get Queue Ticket**, choose an **office** (Registrar, Cashier, Guidance Office, or Admission Office), and choose the **service** you need.
3. Click the button to generate your ticket. You see your **queue number**, your **position**, and your **estimated waiting time** (about 5 minutes per student ahead of you).
4. Open **My Queue** to follow your ticket. It shows the number now being served, how many students are ahead, and your ticket status.
5. Watch the notifications. You are told when you are two numbers away, when you are called, when you are served, and if your ticket is skipped or transferred.
6. A student can only have **one active ticket** at a time. To get a new one, finish or cancel the current ticket. You can only cancel a ticket that is still waiting.
### As Staff
 
1. Sign in with the **Staff** demo account. You are sent to the staff dashboard.
2. Check the summary cards at the top: students in queue, currently serving, waiting, served today, and average waiting time.
3. In **Queue Management**, use the action buttons:
   | Action | What it does |
   |---|---|
   | **Call Next** | Calls the next waiting student for the office. Their status becomes *serving*. Only one ticket per office can be served at a time. |
   | **Serve** | Marks the ticket that is being served as *served* (done). |
   | **Skip** | Marks a waiting or serving ticket as *skipped* (for example, a no-show). |
   | **Transfer** | Moves the ticket to another office. It joins the end of that office's line with a new queue number. |
4. Open **Now Serving** to show the large queue display for an office.
5. Use **Queue History** to search, filter by date, view details, and export to CSV. Use **Reports and Analytics** to see charts.
### Real-Time Test
 
Open the student account in one browser window and the staff account in another (use a private window for the second one). Get a ticket as the student, then press **Call Next** as staff. The student screen updates by itself and shows a notification.
 
## How It Works

1. **Login:** the browser sends the username and password to `/api/auth/login`. The server compares the password with the bcrypt hash stored in SQLite, starts a session, and tells the page which dashboard to open.
2. **Get a ticket:** `POST /api/tickets` saves a new ticket as *waiting*. The server gives it the next number for that office (001, 002, 003, and so on), calculates the estimated wait, and refuses the request if the student already has an active ticket.
3. **Change a ticket:** `PATCH /api/tickets/:id/status` changes the status to *serving*, *served*, *skipped*, or *cancelled*. The server only allows valid changes.
4. **Transfer:** `PATCH /api/tickets/:id/transfer` moves the ticket to another office.
5. **Real time:** after every change, the server sends a `queueUpdated` event to all connected browsers. Each page reloads the ticket list from the server and redraws itself, so no manual refresh is needed. This event-driven flow is the core of the project.
### Ticket Status Flow

```
waiting ──Call Next──▶ serving ──Serve──▶ served
   │                      │
   ├──Cancel──▶ cancelled │
   └──────Skip──▶ skipped ◀┘
```

## Project Structure
 
```
School Office Qeuue/
├── server.js            Express server and Socket.IO setup
├── authRoutes.js        Login API
├── queueRoutes.js       Ticket API (create, status, transfer)
├── database.js          SQLite setup, tables, demo accounts
├── test.js, testLogin.js  Simple API test scripts
├── index.html           Entry page (redirects by role)
├── login.html           Sign-in page
├── create-account.html  Register page
├── reset-password.html  Password reset page
├── student.html         Student dashboard
├── staff.html           Staff dashboard
├── css/                 Stylesheets (style, dashboard, responsive, and per page)
├── js/                  Frontend scripts
│   ├── auth.js, login.js, register.js, reset-password.js
│   ├── app.js           Page navigation and button handling
│   ├── queue.js         Queue logic and server sync
│   ├── realtime.js      Socket.IO client
│   ├── student.js, staff.js
│   └── notifications.js, history.js, reports.js
└── package.json
```
 
## Design

| Element | Color |
|---|---|
| Sidebar | Dark navy `#0B2545` |
| Primary buttons | Blue `#2684E8` |
| Background | Light gray `#F4F7FB` |
| Cards and tables | White `#FFFFFF` |
| Primary text | `#243447` |
| Secondary text | `#7B8794` |
| Borders | `#E5EAF0` |

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot find module` error | Run `npm install` first. |
| Page does not open | Make sure the server is running, then use `http://localhost:3000`. Do not open the `.html` files directly. |
| Port 3000 is already in use | Close the other program using it, or change `PORT` in `server.js`. |
| Icons or charts are missing | Check your internet connection (CDN). |
| Login says "Invalid username or password" | Use the demo accounts above. |
| Want a clean start | Stop the server, delete `school_queue.db`, and start it again. |
 
## Known Limitations
 
- This is an **academic demonstration**. It does not include production-level security, such as HTTPS or login rate limiting.
- Login is checked by the server, but **Create Account** and **Reset Password** save to the browser's `localStorage`. A newly created account cannot sign in through the server login. Use the demo accounts.
- The **Transfer** endpoint expects the office name `finance`, while the rest of the system names that office `cashier`. Transfers to the Cashier may be refused until the two names match.
- The server only listens on `127.0.0.1`, so the system works on the same computer only.
