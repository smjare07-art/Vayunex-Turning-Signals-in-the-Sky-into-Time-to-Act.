import React, { useEffect, useMemo, useState } from "react";
import "./WeatherMap.css";

const API_BASE = "http://localhost:8081";

const WeatherMap = () => {
  /* =========================================================
      LOCATION
  ========================================================= */

  const [location, setLocation] = useState({
    lat: 20.5937,
    lon: 78.9629,
    name: "India",
  });

  const [searchLocation, setSearchLocation] = useState("");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const [weatherResult, setWeatherResult] = useState(null);

  const [locationError, setLocationError] = useState("");

  /* =========================================================
      MAHARASHTRA ML DATA
  ========================================================= */

  const [maharashtraML, setMaharashtraML] = useState(null);

  const [mlLoading, setMLLoading] = useState(true);

  const [mlError, setMLError] = useState("");

  const [activeHazard, setActiveHazard] =
    useState("Thunderstorm");

  const [selectedZone, setSelectedZone] =
    useState("ALL");

  const [selectedDistrict, setSelectedDistrict] =
    useState(null);

  /* =========================================================
      CURRENT LOCATION
  ========================================================= */

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: "Current Location",
        });

        setLoading(false);
      },

      () => {
        setLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  /* =========================================================
      FETCH MAHARASHTRA ML DATA
  ========================================================= */

  const fetchMaharashtraML = async () => {
    try {
      setMLLoading(true);
      setMLError("");

      const response = await fetch(
        `${API_BASE}/api/ml/maharashtra`
      );

      if (!response.ok) {
        throw new Error(
          `ML API Error: ${response.status}`
        );
      }

      const data = await response.json();

      console.log(
        "========== MAHARASHTRA ML =========="
      );

      console.log(data);

      console.log(
        "====================================="
      );

      setMaharashtraML(data);

      /*
       * If currently selected district exists,
       * update it with fresh ML data.
       */

      if (selectedDistrict?.district && data?.zones) {
        let updatedDistrict = null;

        Object.entries(data.zones).forEach(
          ([zoneName, districts]) => {
            const found = districts.find(
              (district) =>
                district.district ===
                selectedDistrict.district
            );

            if (found) {
              updatedDistrict = {
                ...found,
                zone: zoneName,
              };
            }
          }
        );

        if (updatedDistrict) {
          setSelectedDistrict(updatedDistrict);
        }
      }
    } catch (error) {
      console.error(
        "Maharashtra ML Error:",
        error
      );

      setMLError(
        error.message ||
          "Unable to load Maharashtra ML data"
      );
    } finally {
      setMLLoading(false);
    }
  };

  useEffect(() => {
    fetchMaharashtraML();

    /*
      Refresh every 5 minutes
    */

    const interval = setInterval(
      fetchMaharashtraML,
      5 * 60 * 1000
    );

    return () => clearInterval(interval);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
      CONVERT ZONES → DISTRICT ARRAY
  ========================================================= */

  const allDistricts = useMemo(() => {
    if (!maharashtraML?.zones) {
      return [];
    }

    const districts = [];

    Object.entries(
      maharashtraML.zones
    ).forEach(
      ([zoneName, zoneDistricts]) => {
        if (!Array.isArray(zoneDistricts)) {
          return;
        }

        zoneDistricts.forEach(
          (district) => {
            districts.push({
              ...district,
              zone: zoneName,
            });
          }
        );
      }
    );

    return districts;
  }, [maharashtraML]);

  /* =========================================================
      FILTER DISTRICTS BY ZONE
  ========================================================= */

  const visibleDistricts = useMemo(() => {
    if (selectedZone === "ALL") {
      return allDistricts;
    }

    return allDistricts.filter(
      (district) =>
        district.zone === selectedZone
    );
  }, [
    allDistricts,
    selectedZone,
  ]);

  /* =========================================================
      SEARCH LOCATION
  ========================================================= */

  const handleSearch = async () => {
    if (!searchLocation.trim()) {
      return;
    }

    try {
      setSearching(true);
      setLocationError("");
      setWeatherResult(null);

      /*
       * STEP 1
       * Location → Latitude / Longitude
       */

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchLocation
        )}&limit=1`
      );

      if (!response.ok) {
        throw new Error(
          "Location search failed"
        );
      }

      const data = await response.json();

      if (!data.length) {
        setLocationError(
          "Location not found."
        );

        return;
      }

      const lat = parseFloat(
        data[0].lat
      );

      const lon = parseFloat(
        data[0].lon
      );

      const placeName =
        data[0].display_name;

      /*
       * STEP 2
       * Update map location
       */

      setLocation({
        lat,
        lon,
        name: placeName,
      });

      /*
       * STEP 3
       * Backend weather analysis
       */

      const backendResponse =
        await fetch(
          `${API_BASE}/api/weather/analyze`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              latitude: lat,
              longitude: lon,
              location: placeName,
            }),
          }
        );

      const backendData =
        await backendResponse.json();

      if (!backendResponse.ok) {
        throw new Error(
          backendData.message ||
            "Backend error"
        );
      }

      /*
       * STEP 4
       * Weather + ML result
       */

      setWeatherResult(
        backendData
      );

      /*
       * STEP 5
       * Try to find searched district
       */

      const searchName =
        searchLocation
          .trim()
          .toLowerCase();

      const matchingDistrict =
        allDistricts.find(
          (district) => {
            const districtName =
              district.district
                ?.toLowerCase();

            return (
              districtName &&
              (
                districtName.includes(
                  searchName
                ) ||
                searchName.includes(
                  districtName
                )
              )
            );
          }
        );

      if (matchingDistrict) {
        setSelectedDistrict(
          matchingDistrict
        );
      }
    } catch (error) {
      console.error(error);

      setLocationError(
        error.message ||
          "Something went wrong."
      );
    } finally {
      setSearching(false);
    }
  };

  /* =========================================================
      ENTER KEY
  ========================================================= */

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  /* =========================================================
      HAZARD BUTTONS
  ========================================================= */

  const hazardButtons = [
    {
      key: "Thunderstorm",
      label: "Thunderstorm",
      icon: "⛈️",
    },

    {
      key: "Cloudburst",
      label: "Cloudburst",
      icon: "☁️",
    },

    {
      key: "Flash Flood",
      label: "Flash Flood",
      icon: "🌊",
    },
  ];

  /* =========================================================
      GET HAZARD PREDICTION
  ========================================================= */

  const getPrediction = (district) => {
    if (!district?.prediction) {
      return null;
    }

    if (
      activeHazard ===
      "Thunderstorm"
    ) {
      return (
        district.prediction
          ?.thunderstorm || null
      );
    }

    if (
      activeHazard ===
      "Cloudburst"
    ) {
      return (
        district.prediction
          ?.cloudburst || null
      );
    }

    if (
      activeHazard ===
      "Flash Flood"
    ) {
      return (
        district.prediction
          ?.flashFlood || null
      );
    }

    return (
      district.prediction
        ?.thunderstorm || null
    );
  };

  /* =========================================================
      RISK COLOR
  ========================================================= */

  const getRiskColor = (risk) => {
    switch (risk) {
      case "VERY HIGH":
        return "#dc2626";

      case "HIGH":
        return "#f97316";

      case "MEDIUM":
        return "#eab308";

      case "LOW":
      default:
        return "#22c55e";
    }
  };

  /* =========================================================
      RISK LABEL
  ========================================================= */

  const getRiskLabel = (risk) => {
    switch (risk) {
      case "VERY HIGH":
        return "Severe";

      case "HIGH":
        return "High";

      case "MEDIUM":
        return "Medium";

      case "LOW":
      default:
        return "Low";
    }
  };

  /* =========================================================
      RISK CSS CLASS
  ========================================================= */

  const getRiskClass = (risk) => {
    return `risk-${(
      risk || "LOW"
    )
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  };

  /* =========================================================
      DISTRICT RISK
  ========================================================= */

  const getDistrictRisk = (
    district
  ) => {
    const prediction =
      getPrediction(district);

    return (
      prediction?.risk ||
      "LOW"
    );
  };

  /* =========================================================
      SUMMARY COUNTS
  ========================================================= */

  const summary = useMemo(() => {
    let severe = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    visibleDistricts.forEach(
      (district) => {
        const risk =
          getDistrictRisk(
            district
          );

        if (
          risk === "VERY HIGH"
        ) {
          severe++;
        } else if (
          risk === "HIGH"
        ) {
          high++;
        } else if (
          risk === "MEDIUM"
        ) {
          medium++;
        } else {
          low++;
        }
      }
    );

    return {
      severe,
      high,
      medium,
      low,
    };
  }, [
    visibleDistricts,
    activeHazard,
  ]);

  /* =========================================================
      ZONE SUMMARY
  ========================================================= */

  const zoneSummary = useMemo(() => {
    if (!maharashtraML?.zones) {
      return [];
    }

    const priority = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      "VERY HIGH": 4,
    };

    return Object.entries(
      maharashtraML.zones
    ).map(
      ([zoneName, districts]) => {
        let highestRisk = "LOW";

        if (Array.isArray(districts)) {
          districts.forEach(
            (district) => {
              const risk =
                getDistrictRisk(
                  district
                );

              if (
                (priority[risk] || 1) >
                (priority[
                  highestRisk
                ] || 1)
              ) {
                highestRisk = risk;
              }
            }
          );
        }

        return {
          zoneName,
          count:
            Array.isArray(districts)
              ? districts.length
              : 0,
          highestRisk,
        };
      }
    );
  }, [
    maharashtraML,
    activeHazard,
  ]);

  /* =========================================================
      SELECT DISTRICT
  ========================================================= */

  const handleDistrictClick = (
    district
  ) => {
    setSelectedDistrict(
      district
    );

    /*
     * Move Windy map to selected district
     */

    if (
      district?.lat != null &&
      district?.lon != null
    ) {
      setLocation({
        lat: Number(
          district.lat
        ),
        lon: Number(
          district.lon
        ),
        name:
          district.district ||
          "Selected District",
      });
    }
  };

  /* =========================================================
      WINDY URL
  ========================================================= */

  const windyUrl =
    `https://embed.windy.com/embed.html` +
    `?type=map` +
    `&location=coordinates` +
    `&metricRain=default` +
    `&metricTemp=default` +
    `&metricWind=default` +
    `&zoom=7` +
    `&overlay=wind` +
    `&product=ecmwf` +
    `&level=surface` +
    `&lat=${location.lat}` +
    `&lon=${location.lon}`;

  /* =========================================================
      RENDER
  ========================================================= */

  return (
    <div className="weather-map-wrapper">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="weather-map-header">

        <div>
          <h2>
            VEEYOM Weather Intelligence
          </h2>

          <p>
            Hyper-local weather monitoring
            and early warning
          </p>
        </div>

        <div className="location-status">

          <span className="location-dot"></span>

          {location.name}

        </div>

      </div>


      {/* =====================================================
          ML HAZARD FILTER
      ===================================================== */}

      <div className="hazard-filter-bar">

        <div className="hazard-title">
          AI Hazard Monitoring
        </div>

        <div className="hazard-buttons">

          {hazardButtons.map(
            (hazard) => (
              <button
                key={hazard.key}
                type="button"
                className={
                  activeHazard ===
                  hazard.key
                    ? "hazard-btn active"
                    : "hazard-btn"
                }
                onClick={() =>
                  setActiveHazard(
                    hazard.key
                  )
                }
              >

                <span>
                  {hazard.icon}
                </span>

                <span>
                  {hazard.label}
                </span>

              </button>
            )
          )}

        </div>

      </div>


      {/* =====================================================
          MAP
      ===================================================== */}

      <div className="windy-map-container">

        {/* SEARCH BOX */}

        <div className="map-search-box">

          <span className="search-icon">
            📍
          </span>

          <input
            type="text"
            placeholder="Enter village, city or district..."
            value={searchLocation}
            onChange={(e) =>
              setSearchLocation(
                e.target.value
              )
            }
            onKeyDown={
              handleKeyDown
            }
          />

          <button
            onClick={
              handleSearch
            }
            disabled={
              searching
            }
          >
            {searching
              ? "Checking..."
              : "Analyze"}
          </button>

        </div>


        {/* LOCATION ERROR */}

        {locationError && (
          <div className="location-error">
            ⚠️ {locationError}
          </div>
        )}


        {/* SELECTED LOCATION */}

        <div className="selected-location">

          <span>📍</span>

          <div>

            <strong>
              Selected Location
            </strong>

            <small>
              {location.name}
            </small>

          </div>

        </div>


        {/* =================================================
            WINDY MAP
        ================================================= */}

        {loading ? (
          <div className="map-loading">

            <div className="loader"></div>

            <p>
              Loading weather map...
            </p>

          </div>
        ) : (
          <iframe
            key={`${location.lat}-${location.lon}`}
            title="VEEYOM Weather Map"
            src={windyUrl}
            className="windy-iframe"
            frameBorder="0"
            allowFullScreen
          />
        )}


        {/* =================================================
            ML LOADING
        ================================================= */}

        {mlLoading && (
          <div className="ml-map-loading">

            <div className="loader"></div>

            <span>
              Loading VEEYOM AI risk data...
            </span>

          </div>
        )}


        {/* =================================================
            ML ERROR
        ================================================= */}

        {mlError && (
          <div className="ml-map-error">

            ⚠️ {mlError}

          </div>
        )}


        {/* =================================================
            ML DISTRICT OVERLAY
        ================================================= */}

        {!mlLoading &&
          !mlError &&
          visibleDistricts.length > 0 && (
            <div className="ml-district-overlay">

              <div className="overlay-title">

                <span className="live-dot"></span>

                {activeHazard} Risk

              </div>


              <div className="district-list">

                {visibleDistricts.map(
                  (district) => {

                    const risk =
                      getDistrictRisk(
                        district
                      );

                    const color =
                      getRiskColor(
                        risk
                      );

                    const prediction =
                      getPrediction(
                        district
                      );

                    return (
                      <button
                        type="button"
                        key={
                          district.district
                        }
                        className={
                          selectedDistrict
                            ?.district ===
                          district.district
                            ? "district-item selected"
                            : "district-item"
                        }
                        onClick={() =>
                          handleDistrictClick(
                            district
                          )
                        }
                      >

                        <span
                          className="district-risk-dot"
                          style={{
                            backgroundColor:
                              color,
                          }}
                        ></span>


                        <div>

                          <strong>
                            {
                              district.district
                            }
                          </strong>

                          <small>
                            {district.zone}
                          </small>

                        </div>


                        <span
                          className="district-risk"
                          style={{
                            color,
                          }}
                        >

                          {getRiskLabel(
                            risk
                          )}

                        </span>

                      </button>
                    );
                  }
                )}

              </div>

            </div>
          )}


        {/* =================================================
            RISK LEGEND
        ================================================= */}

        <div className="map-risk-legend">

          <strong>
            Risk
          </strong>

          <div>
            <span
              style={{
                background:
                  "#dc2626",
              }}
            ></span>
            Severe
          </div>

          <div>
            <span
              style={{
                background:
                  "#f97316",
              }}
            ></span>
            High
          </div>

          <div>
            <span
              style={{
                background:
                  "#eab308",
              }}
            ></span>
            Medium
          </div>

          <div>
            <span
              style={{
                background:
                  "#22c55e",
              }}
            ></span>
            Low
          </div>

        </div>

      </div>


      {/* =====================================================
          SELECTED DISTRICT DETAILS
      ===================================================== */}

      {selectedDistrict && (
        <div className="selected-district-panel">

          <div className="selected-district-header">

            <div>

              <span>
                DISTRICT AI ANALYSIS
              </span>

              <h3>
                {
                  selectedDistrict.district
                }
              </h3>

              <small>
                {
                  selectedDistrict.zone
                }
              </small>

            </div>


            <button
              type="button"
              onClick={() =>
                setSelectedDistrict(
                  null
                )
              }
            >
              ×
            </button>

          </div>


          <div className="prediction-grid">

            {/* =================================================
                THUNDERSTORM
            ================================================= */}

            <div className="prediction-card">

              <span>
                ⛈️ Thunderstorm
              </span>

              <strong>

                {
                  selectedDistrict
                    ?.prediction
                    ?.thunderstorm
                    ?.probability ?? 0
                }%

              </strong>

              <small
                className={getRiskClass(
                  selectedDistrict
                    ?.prediction
                    ?.thunderstorm
                    ?.risk
                )}
              >

                {
                  selectedDistrict
                    ?.prediction
                    ?.thunderstorm
                    ?.risk ||
                  "LOW"
                }

              </small>

            </div>


            {/* =================================================
                CLOUDBURST
            ================================================= */}

            <div className="prediction-card">

              <span>
                ☁️ Cloudburst
              </span>

              <strong>

                {
                  selectedDistrict
                    ?.prediction
                    ?.cloudburst
                    ?.probability ?? 0
                }%

              </strong>

              <small
                className={getRiskClass(
                  selectedDistrict
                    ?.prediction
                    ?.cloudburst
                    ?.risk
                )}
              >

                {
                  selectedDistrict
                    ?.prediction
                    ?.cloudburst
                    ?.risk ||
                  "LOW"
                }

              </small>

            </div>


            {/* =================================================
                FLASH FLOOD
            ================================================= */}

            <div className="prediction-card">

              <span>
                🌊 Flash Flood
              </span>

              <strong>

                {
                  selectedDistrict
                    ?.prediction
                    ?.flashFlood
                    ?.probability ?? 0
                }%

              </strong>

              <small
                className={getRiskClass(
                  selectedDistrict
                    ?.prediction
                    ?.flashFlood
                    ?.risk
                )}
              >

                {
                  selectedDistrict
                    ?.prediction
                    ?.flashFlood
                    ?.risk ||
                  "LOW"
                }

              </small>

            </div>

          </div>

        </div>
      )}


      {/* =====================================================
          MAHARASHTRA AI SUMMARY
      ===================================================== */}

      {maharashtraML && (
        <div className="maharashtra-ml-panel">

          {/* HEADER */}

          <div className="ml-panel-header">

            <div>

              <span>
                VEEYOM AI MONITORING
              </span>

              <h3>
                Maharashtra Early Warning
              </h3>

              <p>
                Live {activeHazard} prediction
                using XGBoost
              </p>

            </div>


            <div className="ml-live">

              <span></span>

              LIVE

            </div>

          </div>


          {/* =================================================
              SUMMARY STATS
          ================================================= */}

          <div className="ml-stats">

            <div className="ml-stat">

              <span>
                Districts
              </span>

              <strong>
                {
                  maharashtraML
                    .totalDistricts ??
                  allDistricts.length
                }
              </strong>

            </div>


            <div className="ml-stat">

              <span>
                Monitored
              </span>

              <strong>
                {
                  maharashtraML
                    .successfulDistricts ??
                  allDistricts.length
                }
              </strong>

            </div>


            <div className="ml-stat">

              <span>
                Severe
              </span>

              <strong className="severe-text">
                {summary.severe}
              </strong>

            </div>


            <div className="ml-stat">

              <span>
                High
              </span>

              <strong className="high-text">
                {summary.high}
              </strong>

            </div>


            <div className="ml-stat">

              <span>
                Medium
              </span>

              <strong className="medium-text">
                {summary.medium}
              </strong>

            </div>


            <div className="ml-stat">

              <span>
                Low
              </span>

              <strong className="low-text">
                {summary.low}
              </strong>

            </div>

          </div>


          {/* =================================================
              ZONE FILTER
          ================================================= */}

          <div className="zone-filter">

            <button
              type="button"
              className={
                selectedZone ===
                "ALL"
                  ? "zone-filter-btn active"
                  : "zone-filter-btn"
              }
              onClick={() =>
                setSelectedZone(
                  "ALL"
                )
              }
            >
              All Zones
            </button>


            {zoneSummary.map(
              (zone) => (
                <button
                  type="button"
                  key={
                    zone.zoneName
                  }
                  className={
                    selectedZone ===
                    zone.zoneName
                      ? "zone-filter-btn active"
                      : "zone-filter-btn"
                  }
                  onClick={() =>
                    setSelectedZone(
                      zone.zoneName
                    )
                  }
                >

                  {zone.zoneName}

                  <span>
                    {zone.count}
                  </span>

                </button>
              )
            )}

          </div>


          {/* =================================================
              ZONE CARDS
          ================================================= */}

          <div className="zone-grid">

            {zoneSummary.map(
              (zone) => {

                const zoneColor =
                  getRiskColor(
                    zone.highestRisk
                  );

                return (
                  <button
                    type="button"
                    key={
                      zone.zoneName
                    }
                    className={
                      selectedZone ===
                      zone.zoneName
                        ? "zone-card selected"
                        : "zone-card"
                    }
                    onClick={() =>
                      setSelectedZone(
                        zone.zoneName
                      )
                    }
                  >

                    <div className="zone-card-top">

                      <span
                        className="zone-risk-dot"
                        style={{
                          backgroundColor:
                            zoneColor,
                        }}
                      ></span>

                      <span
                        style={{
                          color:
                            zoneColor,
                        }}
                      >

                        {getRiskLabel(
                          zone.highestRisk
                        )}

                      </span>

                    </div>


                    <h4>
                      {zone.zoneName}
                    </h4>


                    <p>
                      {zone.count} districts
                    </p>

                  </button>
                );
              }
            )}

          </div>


          {/* =================================================
              SOURCE
          ================================================= */}

          <div className="ml-source">

            <span>
              ●
            </span>

            Source: Open-Meteo GFS + VEEYOM
            XGBoost

            <span className="refresh-info">
              Auto refresh: 5 min
            </span>

          </div>

        </div>
      )}


      {/* =====================================================
          SEARCH ML RESULT
      ===================================================== */}

      {weatherResult && (
        <div className="prediction-panel">

          <div>

            <span>
              Weather Risk
            </span>

            <strong>
              {weatherResult.prediction}
            </strong>

          </div>


          <div>

            <span>
              Risk Score
            </span>

            <strong>
              {weatherResult.riskScore}%
            </strong>

          </div>


          <div>

            <span>
              Location
            </span>

            <strong>
              {location.name}
            </strong>

          </div>

        </div>
      )}

    </div>
  );
};

export default WeatherMap;