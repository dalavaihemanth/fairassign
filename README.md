# FairAssign

A modern web application built with React, TypeScript, and Vite for managing examination schedules and faculty invigilation duties.

## Features

- **Faculty Management:** Add, edit, and manage faculty members, their departments, and max duties.
- **Exam Slot Management:** Create and configure examination slots (dates, sessions, and required invigilators).
- **Auto-Allocation:** An intelligent algorithm to automatically assign faculty to exam slots while respecting constraints:
  - Avoid assigning the same faculty to multiple sessions on the same day.
  - Respect the maximum defined duties for each faculty.
  - Prioritize faculty based on defined roles.
- **Conflict Resolution:** Identify and resolve scheduling conflicts manually if auto-assignment falls short.
- **Reporting:** Export generated schedules and faculty allocation reports as CSV or XLSX files.
- **Dark Mode Support:** Built-in light and dark themes.

## Technologies Used

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

## Getting Started

### Prerequisites

You will need [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository and navigate into the directory.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:8080`.

## Building for Production

To create a production-ready build:

```sh
npm run build
```

This will generate a `dist` folder which can be deployed to any static hosting provider.
