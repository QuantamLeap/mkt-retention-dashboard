# Retainly Marketing Retention Dashboard

A browser-based dashboard for tracking festival campaigns, player rewards, and total campaign cost.

## Use the dashboard

Open `index.html` in a modern browser. No installation or build step is required.

- Create campaigns from **New event**.
- Record free credits or physical gifts from **Issue reward**.
- Review cost, recipients, budgets, and reward mix on **Overview**.
- Search and filter records under **Player rewards**.
- Download the full reward ledger with **Export CSV**.

Records are stored in the browser's local storage on the current device. Clearing browser site data will remove entered records. For shared multi-user use, the next step is connecting the dashboard to an authenticated database.

## Files

- `index.html` contains the application structure and forms.
- `styles.css` contains the responsive visual system.
- `app.js` contains records, calculations, filtering, export, and local persistence.