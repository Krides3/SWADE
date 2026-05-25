# LUXOR — Tactical Operations Terminal

LUXOR is a web-based, cyberpunk-themed tactical dashboard designed for **Savage Worlds (SWADE)** and similar tabletop RPGs. It provides a real-time interface for handlers (GMs) and operators (players) to manage missions, signals, assets, and role assignments.

## 🛠 Tech Stack
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Maps:** Leaflet.js
- **Icons/Fonts:** Google Fonts (Orbitron, Rajdhani, Share Tech Mono)
- **Backend (Planned):** [Convex](https://www.convex.dev/) for real-time data and persistence.
- **Hosting:** GitHub Pages (Frontend)

## 🚀 Development Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Convex Account](https://www.convex.dev/) (Free tier is sufficient)

### 2. Local Installation
```bash
# Clone the repository
git clone https://github.com/your-username/LUXOR.git
cd LUXOR

# Install dependencies
npm install

# Initialize Convex (if not already set up)
npx convex dev
```

### 3. Running the Terminal
Currently, the site is transitioning to a hybrid model. You can run the frontend using any local development server:
- **VS Code:** Use the "Live Server" extension.
- **Python:** `python -m http.server 8000`
- **Node.js:** `npx serve .`

## 📡 Convex Integration (In Progress)
We are transitioning from `localStorage` to **Convex** to support cross-device synchronization and persistence.

### Convex Deployment Steps:
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Initialize Backend:**
    ```bash
    npx convex dev
    ```
    *This will prompt you to log in and create a new project. It will also generate the `convex/_generated` files.*

3.  **Seed the Database:**
    Once your dashboard is open, run the `operators:seed` mutation to populate the initial roster (OVERLORD, HADES, and Team DAGGER).

4.  **Frontend Connection:**
    Add the Convex client to your HTML files:
    ```html
    <script src="https://unpkg.com/convex@latest/dist/browser.bundle.js"></script>
    <script>
      const client = new Convex.ConvexClient("YOUR_CONVEX_URL_HERE");
    </script>
    ```

### Roadmap:
- [x] **Callsign-Only Auth:** Password-free login for rapid tactical access.
- [x] **Mission Backend:** Schema and logic for detailed briefings (Name, Date, Location, Squad, Leader).
- [ ] **Mission Ownership:** Enforcement of handler-specific editing permissions.
- [ ] **Briefing Tool UI:** Real-time editor for handlers to publish missions.
- [ ] **Team DAGGER Roster:** Persistence of role assignments and equipment loadouts.
- [ ] **Signal Intelligence:** Persist captured signals and logs.

## 🎨 Design System
Refer to [STYLE.md](./STYLE.md) for detailed specifications on:
- Color Palette (Gold, Purple, Cyan, Danger)
- CRT & Glitch Animations
- Typography (Orbitron for headers, Share Tech Mono for data)

## 📁 Project Structure
- `/AssetMap`: Leaflet-based tactical map system.
- `/RadioScanner`: SIGINT (Signal Intelligence) simulation.
- `auth.js`: Current authentication logic (local).
- `admin.html/js`: Handler-side management tools.
- `index.html`: Main terminal entry point.

---
**AUTHORIZATION REQUIRED:** ACCESS TO THIS TERMINAL IS RESTRICTED TO CLEARANCE LEVEL 1-5 PERSONNEL. UNLAWFUL ACCESS WILL BE TRACED AND TERMINATED.
