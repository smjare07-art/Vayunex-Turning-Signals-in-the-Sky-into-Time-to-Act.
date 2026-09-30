import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Grid2X2,
  Bell,
  MapPin,
  Search,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";

import veeyomLogo from "../assets/VEEYOM_logo.jpeg";
import "./Navbar.css";

function Navbar() {
  const [languageOpen, setLanguageOpen] = useState(false);
  const [language, setLanguage] = useState("EN");

  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("veeyom-theme");

    if (savedTheme) {
      return savedTheme === "dark";
    }

    return true;
  });

  const username = localStorage.getItem("username");

  // ============================================
  // APPLY THEME
  // ============================================

  useEffect(() => {
    const theme = darkMode ? "dark" : "light";

    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    localStorage.setItem("veeyom-theme", theme);
  }, [darkMode]);

  // ============================================
  // LANGUAGE
  // ============================================

  const changeLanguage = (selectedLanguage) => {
    setLanguage(selectedLanguage);
    setLanguageOpen(false);
  };

  // ============================================
  // THEME
  // ============================================

  const toggleTheme = () => {
    setDarkMode((current) => !current);
  };

  return (
    <nav className="veeyom-navbar">

      {/* =========================================
          LEFT SECTION
      ========================================== */}

      <div className="navbar-left">

        {/* APP GRID BUTTON */}

        <button
          className="navbar-icon-button"
          type="button"
          title="Menu"
        >
          <Grid2X2 size={17} strokeWidth={2.2} />
        </button>


        {/* NOTIFICATION */}

        <button
          className="navbar-icon-button notification-button"
          type="button"
          title="Notifications"
        >
          <Bell size={17} strokeWidth={2.2} />

          <span className="notification-dot"></span>
        </button>


        {/* LOCATION */}

        <div className="navbar-location">

          <MapPin
            size={15}
            strokeWidth={2.5}
          />

          <span>Pune, India</span>

        </div>

      </div>


      {/* =========================================
          SEARCH
      ========================================== */}

      <div className="navbar-search">

        <Search
          size={17}
          strokeWidth={2}
        />

        <input
          type="text"
          placeholder="Search city..."
          aria-label="Search city"
        />

      </div>


      {/* =========================================
          RIGHT SECTION
      ========================================== */}

      <div className="navbar-right">

        {/* THEME TOGGLE */}

        <button
          type="button"
          className={`theme-toggle ${
            darkMode ? "dark-active" : "light-active"
          }`}
          onClick={toggleTheme}
          title={
            darkMode
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
        >

          <span className="theme-icon sun-icon">
            <Sun size={16} />
          </span>

          <span className="theme-icon moon-icon">
            <Moon size={16} />
          </span>

        </button>


        {/* LANGUAGE */}

        <div className="language-wrapper">

          <button
            type="button"
            className="language-button"
            onClick={() =>
              setLanguageOpen(
                (current) => !current
              )
            }
          >
            {language}

            <ChevronDown
              size={13}
              className={
                languageOpen
                  ? "language-chevron open"
                  : "language-chevron"
              }
            />
          </button>


          {languageOpen && (
            <div className="language-menu">

              <button
                type="button"
                onClick={() =>
                  changeLanguage("EN")
                }
              >
                English
              </button>

              <button
                type="button"
                onClick={() =>
                  changeLanguage("MR")
                }
              >
                मराठी
              </button>

            </div>
          )}

        </div>


        {/* USER */}

        {username ? (
          <div className="navbar-user">

            <div className="user-avatar">
              {username
                .charAt(0)
                .toUpperCase()}
            </div>

            <span className="user-name">
              {username}
            </span>

          </div>
        ) : (
          <Link
            to="/login"
            className="user-avatar guest-avatar"
            title="Login"
          >
            ?
          </Link>
        )}

      </div>

    </nav>
  );
}

export default Navbar;