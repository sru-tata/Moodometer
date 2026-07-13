import DemoApp from "./apps/DemoApp/App";

// Top-level App is intentionally a thin shell. All routes, providers,
// pages, components, and business logic for this project live inside
// src/apps/DemoApp — see App.jsx there for the full route table.
export default function App() {
  return <DemoApp />;
}
