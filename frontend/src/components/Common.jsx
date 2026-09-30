import React from "react";

export function StatCard({
  icon,
  label,
  value,
  note,
  tone = "blue",
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon">
        {icon}
      </div>

      <div className="stat-info">
        <p>{label}</p>
        <h2>{value}</h2>
        <span>{note}</span>
      </div>
    </div>
  );
}


export function Status({ children }) {
  const status = String(children).toLowerCase();

  return (
    <span className={`status status-${status}`}>
      {children}
    </span>
  );
}


export function SystemStatus() {
  const systems = [
    {
      name: "Backend API",
      status: "Operational",
      icon: "🟢",
    },
    {
      name: "Database",
      status: "Operational",
      icon: "🟢",
    },
    {
      name: "Weather Data",
      status: "Connected",
      icon: "🟢",
    },
    {
      name: "AI Prediction",
      status: "Operational",
      icon: "🟢",
    },
  ];

  return (
    <div className="system-status-grid">
      {systems.map((system) => (
        <div className="system-status-item" key={system.name}>

          <div className="system-status-name">
            <span>{system.icon}</span>
            <strong>{system.name}</strong>
          </div>

          <small>{system.status}</small>

        </div>
      ))}
    </div>
  );
}