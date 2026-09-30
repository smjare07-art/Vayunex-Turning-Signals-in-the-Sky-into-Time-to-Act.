import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8081";

function AlertAreas() {
  const [mlData, setMlData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Temporary dam data
  // Later this can come from CWC/NWIC backend API
  const dams = [
    {
      name: "Koyna Dam",
      capacity: 86,
      status: "Monitor",
    },
    {
      name: "Ujani Dam",
      capacity: 72,
      status: "Monitor",
    },
    {
      name: "Jayakwadi Dam",
      capacity: 81,
      status: "Monitor",
    },
    {
      name: "Ukai Dam",
      capacity: 77,
      status: "Monitor",
    },
    {
      name: "Khadakwasla Dam",
      capacity: 68,
      status: "Normal",
    },
  ];

  // ==========================================
  // FETCH MAHARASHTRA ML DATA
  // ==========================================

  const fetchMLData = async () => {
    try {
      setError("");

      const response = await fetch(
        `${API_BASE}/api/ml/maharashtra`
      );

      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.message || "ML data unavailable"
        );
      }

      setMlData(result);

    } catch (err) {
      console.error(
        "Alert Areas ML Error:",
        err
      );

      setError(
        "Unable to load live alert data"
      );

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMLData();

    // Refresh every 5 minutes
    const interval = setInterval(
      fetchMLData,
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // CONVERT ZONE DATA → DISTRICT LIST
  // ==========================================

  const allDistricts = useMemo(() => {
    if (!mlData?.zones) {
      return [];
    }

    return Object.values(
      mlData.zones
    ).flat();
  }, [mlData]);

  // ==========================================
  // GET HIGHEST HAZARD
  // ==========================================

  const getHighestHazard = (prediction) => {
    if (!prediction) {
      return {
        name: "Unknown",
        probability: 0,
        risk: "LOW",
      };
    }

    const hazards = [
      {
        name: "Thunderstorm",
        data: prediction.thunderstorm,
      },
      {
        name: "Cloudburst",
        data: prediction.cloudburst,
      },
      {
        name: "Flash Flood",
        data: prediction.flashFlood,
      },
    ];

    hazards.sort(
      (a, b) =>
        (b.data?.probability || 0) -
        (a.data?.probability || 0)
    );

    return {
      name: hazards[0].name,
      probability:
        hazards[0].data?.probability || 0,
      risk:
        hazards[0].data?.risk || "LOW",
    };
  };

  // ==========================================
  // HIGH ALERT AREAS
  // ==========================================

  const alertData = useMemo(() => {
    return allDistricts
      .map((district) => {
        const hazard = getHighestHazard(
          district.prediction
        );

        return {
          location: district.district,
          probability: hazard.probability,
          event: hazard.name,
          risk: hazard.risk,
          zone: district.zone,
        };
      })
      .filter(
        (item) =>
          item.risk === "HIGH" ||
          item.risk === "VERY HIGH"
      )
      .sort(
        (a, b) =>
          b.probability -
          a.probability
      )
      .slice(0, 7);
  }, [allDistricts]);

  // ==========================================
  // RISK CLASS
  // ==========================================

  const getRiskClass = (risk) => {
    switch (risk) {
      case "VERY HIGH":
        return "risk-very-high";

      case "HIGH":
        return "risk-high";

      case "MEDIUM":
        return "risk-medium";

      default:
        return "risk-low";
    }
  };

  // ==========================================
  // DAM STATUS
  // ==========================================

  const getDamClass = (capacity) => {
    if (capacity >= 90) {
      return "dam-danger";
    }

    if (capacity >= 75) {
      return "dam-warning";
    }

    return "dam-normal";
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <section className="alert-grid">

        <div className="dashboard-card alert-loading">

          <div className="card-title-row">
            <h5>
              High Alert Area (Location)
            </h5>

            <span className="live-badge">
              LIVE
            </span>
          </div>

          <p>
            Loading live Maharashtra
            ML alerts...
          </p>

        </div>

        <div className="dashboard-card alert-loading">

          <h5>
            Dam Capacity Location Area
          </h5>

          <p>
            Loading dam information...
          </p>

        </div>

      </section>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================

  if (error) {
    return (
      <section className="alert-grid">

        <div className="dashboard-card">

          <div className="card-title-row">

            <h5>
              High Alert Area (Location)
            </h5>

            <span className="live-badge">
              LIVE
            </span>

          </div>

          <div className="alert-error">
            {error}

            <button
              onClick={fetchMLData}
              className="retry-btn"
            >
              Retry
            </button>
          </div>

        </div>

      </section>
    );
  }

  return (
    <section className="alert-grid">

      {/* ===================================== */}
      {/* HIGH ALERT AREAS */}
      {/* ===================================== */}

      <div className="dashboard-card">

        <div className="card-title-row">

          <h5>
            High Alert Area (Maharashtra)
          </h5>

          <span className="live-badge">
            ● LIVE
          </span>

        </div>

        <div className="table-scroll">

          <table className="alert-table">

            <thead>

              <tr>

                <th>
                  Location
                </th>

                <th>
                  Probability
                </th>

                <th>
                  Event
                </th>

              </tr>

            </thead>

            <tbody>

              {alertData.length === 0 ? (

                <tr>

                  <td
                    colSpan="3"
                    className="no-alert"
                  >
                    No high-risk areas detected
                  </td>

                </tr>

              ) : (

                alertData.map(
                  (item, index) => (

                    <tr
                      key={`${item.location}-${index}`}
                    >

                      <td>

                        <strong>
                          {item.location}
                        </strong>

                        <small>
                          {item.zone}
                        </small>

                      </td>

                      <td>

                        <strong
                          className={getRiskClass(
                            item.risk
                          )}
                        >
                          {item.probability.toFixed(
                            2
                          )}
                          %
                        </strong>

                      </td>

                      <td>

                        <span
                          className={`event-badge ${getRiskClass(
                            item.risk
                          )}`}
                        >
                          {item.event}
                        </span>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

        <div className="alert-footer">

          <span>
            Total Districts:
            <strong>
              {" "}
              {mlData?.totalDistricts ||
                allDistricts.length}
            </strong>
          </span>

          <span>
            High Risk:
            <strong>
              {" "}
              {alertData.length}
            </strong>
          </span>

        </div>

      </div>

      {/* ===================================== */}
      {/* DAM CAPACITY */}
      {/* ===================================== */}

      <div className="dashboard-card">

        <div className="card-title-row">

          <h5>
            Dam Capacity Location Area
          </h5>

          <span className="live-badge">
            LIVE
          </span>

        </div>

        <div className="dam-content">

          {/* MAP */}

          <div className="dam-image">

            <div className="india-mini-map">

              <div className="india-shape">
                🇮🇳
              </div>

              <span>
                MAHARASHTRA
              </span>

            </div>

          </div>

          {/* DAM LIST */}

          <div className="dam-list">

            {dams.map(
              (dam, index) => (

                <div
                  className="dam-item"
                  key={index}
                >

                  <span
                    className={`dam-dot ${getDamClass(
                      dam.capacity
                    )}`}
                  ></span>

                  <div className="dam-info">

                    <strong>
                      {dam.name}
                    </strong>

                    <span>
                      {dam.capacity}%
                      Capacity
                    </span>

                  </div>

                  <span
                    className={`dam-status ${getDamClass(
                      dam.capacity
                    )}`}
                  >
                    {dam.status}
                  </span>

                </div>

              )
            )}

          </div>

        </div>

      </div>

    </section>
  );
}

export default AlertAreas;