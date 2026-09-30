import React from "react";
import WindMap from "./WindMap";

import {
  StatCard,
  Status,
  SystemStatus,
} from "../components/Common";

import Sidebar from "../components/Sidebar";

import "./Style.css";


const Dashboard = () => {

  // =========================
  // LOGGED-IN USER
  // =========================

  const username = localStorage.getItem("username");


  return (

    <div className="d1">

      {/* =========================
          SIDEBAR
      ========================== */}

      {/* <Sidebar /> */}


      {/* =========================
          DASHBOARD PAGE
      ========================== */}

      <div className="dashboard-page">


        {/* =========================
            USER - TOP RIGHT
        ========================== */}

        <div className="dashboard-user">

          <div className="dashboard-user-avatar">

            {username
              ? username.charAt(0).toUpperCase()
              : "U"}

          </div>


          <div className="dashboard-user-info">

            <span>
              Welcome
            </span>

            <strong>
              {username || "User"}
            </strong>

          </div>

        </div>



        {/* =========================
            PAGE HEADER
        ========================== */}

        <div className="page-header">

          <div>

            <span className="page-eyebrow">
              VAYUNEX ADMIN
            </span>


            <h1>
              Dashboard
            </h1>


            <p>
              Real-time severe weather monitoring and AI risk overview
            </p>

          </div>


          <div className="dashboard-date">

            <span>
              ● LIVE SYSTEM
            </span>


            <small>
              Weather monitoring active
            </small>

          </div>

        </div>



        {/* =========================
            STAT CARDS
        ========================== */}

        <div className="dashboard-stats">


          <StatCard
            icon="🏗️"
            label="Total Dams"
            value="24"
            note="Registered reservoirs"
            tone="blue"
          />


          <StatCard
            icon="⚠️"
            label="Active Alerts"
            value="08"
            note="03 critical alerts"
            tone="red"
          />


          <StatCard
            icon="🌧️"
            label="Rainfall Alerts"
            value="12"
            note="Last 24 hours"
            tone="orange"
          />


          <StatCard
            icon="👥"
            label="Total Users"
            value="1,248"
            note="Active users"
            tone="green"
          />

        </div>



        {/* =========================
            MAIN GRID
        ========================== */}

        <div className="dashboard-grid">


          {/* =========================
              INDIA RISK MAP
          ========================== */}

          <div className="dashboard-card map-card">


            <div className="card-header">


              <div>

                <span className="card-eyebrow">
                  LIVE MONITORING
                </span>


                <h2>
                  India Risk Map
                </h2>


                <p>
                  AI-powered weather and disaster risk monitoring
                </p>

              </div>


              <button className="primary-btn">
                View Full Map →
              </button>

            </div>


            <div className="dashboard-map">

              <WindMap />

            </div>

          </div>



          {/* =========================
              ACTIVE ALERTS
          ========================== */}

          <div className="dashboard-card">


            <div className="card-header">


              <div>

                <span className="card-eyebrow">
                  WARNING SYSTEM
                </span>


                <h2>
                  Active Alerts
                </h2>


                <p>
                  Latest severe weather warnings
                </p>

              </div>


              <button className="text-btn">
                View All
              </button>

            </div>



            <div className="alerts-list">


              {/* FLASH FLOOD */}

              <div className="dashboard-alert critical">


                <div className="alert-icon">
                  ⚡
                </div>


                <div className="alert-content">

                  <h3>
                    Flash Flood Risk
                  </h3>


                  <p>
                    Sangli, Maharashtra
                  </p>


                  <small>
                    Expected in 2 hours
                  </small>

                </div>


                <Status>
                  Critical
                </Status>

              </div>



              {/* THUNDERSTORM */}

              <div className="dashboard-alert high">


                <div className="alert-icon">
                  ⛈️
                </div>


                <div className="alert-content">

                  <h3>
                    Severe Thunderstorm
                  </h3>


                  <p>
                    Satara, Maharashtra
                  </p>


                  <small>
                    Expected in 4–5 hours
                  </small>

                </div>


                <Status>
                  High
                </Status>

              </div>



              {/* DAM */}

              <div className="dashboard-alert high">


                <div className="alert-icon">
                  💧
                </div>


                <div className="alert-content">

                  <h3>
                    Dam Water Level High
                  </h3>


                  <p>
                    Koyna Dam
                  </p>


                  <small>
                    Reservoir at 92% capacity
                  </small>

                </div>


                <Status>
                  High
                </Status>

              </div>



              {/* RAINFALL */}

              <div className="dashboard-alert moderate">


                <div className="alert-icon">
                  🌧️
                </div>


                <div className="alert-content">

                  <h3>
                    Heavy Rainfall
                  </h3>


                  <p>
                    Kolhapur, Maharashtra
                  </p>


                  <small>
                    Next 2 hours
                  </small>

                </div>


                <Status>
                  Moderate
                </Status>

              </div>


            </div>

          </div>

        </div>



        {/* =========================
            SECOND ROW
        ========================== */}

        <div className="dashboard-grid">


          {/* =========================
              DAM MONITORING
          ========================== */}

          <div className="dashboard-card">


            <div className="card-header">


              <div>

                <span className="card-eyebrow">
                  RESERVOIR MONITORING
                </span>


                <h2>
                  High Alert Dams
                </h2>


                <p>
                  Current reservoir storage status
                </p>

              </div>


              <button className="text-btn">
                View All
              </button>

            </div>



            <div className="dam-monitoring">


              {/* KOYNA */}

              <div className="dam-row">


                <div className="dam-info">


                  <div className="dam-avatar">
                    K
                  </div>


                  <div>

                    <h3>
                      Koyna Dam
                    </h3>

                    <p>
                      Satara, Maharashtra
                    </p>

                  </div>

                </div>


                <div className="dam-level">

                  <strong>
                    92%
                  </strong>

                  <span>
                    Storage
                  </span>

                </div>


                <Status>
                  Critical
                </Status>

              </div>



              {/* ALMATTI */}

              <div className="dam-row">


                <div className="dam-info">


                  <div className="dam-avatar">
                    A
                  </div>


                  <div>

                    <h3>
                      Almatti Dam
                    </h3>

                    <p>
                      Vijayapura, Karnataka
                    </p>

                  </div>

                </div>


                <div className="dam-level">

                  <strong>
                    89%
                  </strong>

                  <span>
                    Storage
                  </span>

                </div>


                <Status>
                  High
                </Status>

              </div>



              {/* UJANI */}

              <div className="dam-row">


                <div className="dam-info">


                  <div className="dam-avatar">
                    U
                  </div>


                  <div>

                    <h3>
                      Ujani Dam
                    </h3>

                    <p>
                      Solapur, Maharashtra
                    </p>

                  </div>

                </div>


                <div className="dam-level">

                  <strong>
                    87%
                  </strong>

                  <span>
                    Storage
                  </span>

                </div>


                <Status>
                  High
                </Status>

              </div>



              {/* TUNGABHADRA */}

              <div className="dam-row">


                <div className="dam-info">


                  <div className="dam-avatar">
                    T
                  </div>


                  <div>

                    <h3>
                      Tungabhadra Dam
                    </h3>

                    <p>
                      Hospet, Karnataka
                    </p>

                  </div>

                </div>


                <div className="dam-level">

                  <strong>
                    82%
                  </strong>

                  <span>
                    Storage
                  </span>

                </div>


                <Status>
                  High
                </Status>

              </div>


            </div>

          </div>



          {/* =========================
              AI PREDICTION
          ========================== */}

          <div className="dashboard-card ai-card">


            <div className="card-header">


              <div>

                <span className="card-eyebrow">
                  ARTIFICIAL INTELLIGENCE
                </span>


                <h2>
                  AI Prediction
                </h2>


                <p>
                  Current model prediction
                </p>

              </div>


              <div className="ai-badge">
                XGBoost
              </div>

            </div>



            <div className="prediction-main">


              {/* SCORE */}

              <div className="risk-score">


                <div className="score-circle">

                  <strong>
                    87
                  </strong>

                  <span>
                    %
                  </span>

                </div>


                <div>

                  <h3>
                    High Risk
                  </h3>

                  <p>
                    Severe weather probability
                  </p>

                </div>

              </div>



              {/* EVENT */}

              <div className="prediction-event">

                <span>
                  Predicted Event
                </span>


                <h3>
                  ⛈️ Severe Thunderstorm
                </h3>


                <p>
                  Satara, Maharashtra
                </p>

              </div>



              {/* TIME */}

              <div className="prediction-time">


                <div>

                  <span>
                    Expected Time
                  </span>

                  <strong>
                    2–6 Hours
                  </strong>

                </div>


                <div>

                  <span>
                    Model Confidence
                  </span>

                  <strong>
                    94.2%
                  </strong>

                </div>

              </div>


            </div>


            <button className="prediction-btn">
              View AI Prediction →
            </button>

          </div>

        </div>



        {/* =========================
            SYSTEM STATUS
        ========================== */}

        <div className="dashboard-card system-card">


          <div className="card-header">


            <div>

              <span className="card-eyebrow">
                SYSTEM MONITORING
              </span>


              <h2>
                System Status
              </h2>


              <p>
                Current Vayunex platform health
              </p>

            </div>


            <div className="system-live">

              <span></span>

              All systems operational

            </div>

          </div>


          <SystemStatus />

        </div>


      </div>

    </div>

  );

};


export default Dashboard;