import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = () => {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">

      {/* LOGO */}
      <div className="sidebar-logo">
        <div className="logo-mark">V</div>

        <div>
          <h2>VEEYOM</h2>
          <p>Admin Panel</p>
        </div>
      </div>


      {/* MAIN MENU */}
      <div className="sidebar-section">

        <span className="sidebar-title">
          MAIN MENU
        </span>

        <nav className="sidebar-nav">

          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">▦</span>
            <span>Dashboard</span>
          </NavLink>


          <NavLink
            to="/admin/live-monitoring"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">◉</span>
            <span>Live Monitoring</span>
          </NavLink>


          <NavLink
            to="/admin/alerts"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">⚠</span>
            <span>Alerts</span>

            <span className="menu-badge">
              08
            </span>
          </NavLink>


          <NavLink
            to="/admin/dams"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">▤</span>
            <span>Dams & Reservoirs</span>
          </NavLink>


          <NavLink
            to="/admin/weather"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">☁</span>
            <span>Weather Data</span>
          </NavLink>


          <NavLink
            to="/admin/ai-predictions"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">✦</span>
            <span>AI Predictions</span>
          </NavLink>


          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">♙</span>
            <span>Users</span>
          </NavLink>


          <NavLink
            to="/admin/reports"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">▥</span>
            <span>Reports</span>
          </NavLink>

        </nav>

      </div>


      {/* SYSTEM */}
      <div className="sidebar-section">

        <span className="sidebar-title">
          SYSTEM
        </span>

        <nav className="sidebar-nav">

          <NavLink
            to="/admin/api-health"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">✓</span>
            <span>API Health</span>
          </NavLink>


          <NavLink
            to="/admin/system-logs"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">≡</span>
            <span>System Logs</span>
          </NavLink>


          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="sidebar-icon">⚙</span>
            <span>Settings</span>
          </NavLink>

        </nav>

      </div>


      {/* BOTTOM */}
      <div className="sidebar-bottom">

        <div className="sidebar-status">
          <span className="online-dot"></span>

          <div>
            <strong>System Online</strong>
            <small>All services operational</small>
          </div>
        </div>


        <button
          className="logout-btn"
          onClick={() => navigate("/login")}
        >
          <span>↪</span>
          Logout
        </button>

      </div>

    </aside>
  );
};

export default Sidebar;