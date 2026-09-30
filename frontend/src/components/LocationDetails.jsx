import React, { useEffect, useState } from "react";
import "./LocationDetails.css";

const API_URL = "http://localhost:8081";

function LocationDetails() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userLocation, setUserLocation] = useState(null);

  // ============================================================
  // GET USER CURRENT LOCATION
  // ============================================================

  const getUserLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error("Geolocation is not supported by this browser")
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },

        (locationError) => {
          console.error("Geolocation Error:", locationError);

          let message = "Unable to get your current location";

          if (locationError.code === 1) {
            message =
              "Location permission denied. Please allow location access.";
          } else if (locationError.code === 2) {
            message = "Your location is currently unavailable.";
          } else if (locationError.code === 3) {
            message = "Location request timed out.";
          }

          reject(new Error(message));
        },

        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        }
      );
    });
  };

  // ============================================================
  // FETCH LOCATION ML DATA
  // ============================================================

  const fetchLocationData = async () => {
    try {
      setLoading(true);
      setError("");

      const location = await getUserLocation();

      setUserLocation(location);

      console.log("User Location:", location);

      const url =
        `${API_URL}/api/ml/location` +
        `?lat=${encodeURIComponent(location.latitude)}` +
        `&lon=${encodeURIComponent(location.longitude)}`;

      console.log("Fetching:", url);

      const response = await fetch(url);

      if (!response.ok) {
        let serverMessage = `Server returned ${response.status}`;

        try {
          const errorData = await response.json();

          if (errorData?.message) {
            serverMessage = errorData.message;
          }

          if (errorData?.error) {
            serverMessage = errorData.error;
          }
        } catch (jsonError) {
          // Ignore JSON parsing error
        }

        throw new Error(serverMessage);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.message || "Unable to load weather data"
        );
      }

      console.log("Location ML Data:", result);

      setData(result);
    } catch (err) {
      console.error("Location Details Error:", err);

      setError(
        err.message || "Unable to fetch live weather data"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchLocationData();
  }, []);

  // ============================================================
  // AUTO REFRESH - 5 MINUTES
  // ============================================================

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLocationData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="dashboard-card location-card">
        <div className="card-title-row">
          <h5>Current Location Details</h5>

          <span className="location-status loading-status">
            ● Loading
          </span>
        </div>

        <div className="location-loading">
          <div className="loading-spinner"></div>

          <p>Detecting your current location...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error || !data) {
    return (
      <div className="dashboard-card location-card">
        <div className="card-title-row">
          <h5>Current Location Details</h5>

          <span className="location-status offline-status">
            ● Offline
          </span>
        </div>

        <div className="location-error">
          <div className="error-icon">⚠️</div>

          <p>{error || "Weather data unavailable"}</p>

          <button
            onClick={fetchLocationData}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // EXTRACT DATA
  // ============================================================

  const features = data.features || {};
  const prediction = data.prediction || {};

  const latitude =
    data.latitude ??
    data.lat ??
    userLocation?.latitude ??
    0;

  const longitude =
    data.longitude ??
    data.lon ??
    userLocation?.longitude ??
    0;

  const temperature =
    features.temperature_c ??
    features.t2m ??
    features.temperature ??
    "--";

  const humidity =
    features.relative_humidity ??
    features.humidity ??
    "--";

  const windSpeed =
    features.wind_speed_10m ??
    features.wind_speed ??
    "--";

  const windDirection =
    features.wind_direction_10m ??
    features.wind_direction ??
    "--";

  const rainfall =
    features.precipitation_mm ??
    features.rain_1h ??
    features.precipitation ??
    0;

  // ============================================================
  // WEATHER CONDITION
  // ============================================================

  const getWeatherCondition = (rainValue, humidityValue) => {
    const rain = Number(rainValue);
    const hum = Number(humidityValue);

    if (rain >= 20) return "Heavy Rain";
    if (rain >= 5) return "Rain";
    if (rain > 0) return "Light Rain";
    if (hum >= 85) return "Cloudy";
    if (hum >= 65) return "Partly Cloudy";

    return "Clear";
  };

  const weatherCondition = getWeatherCondition(
    rainfall,
    humidity
  );

  // ============================================================
  // WEATHER ICON
  // ============================================================

  const getWeatherIcon = (rainValue, humidityValue) => {
    const rain = Number(rainValue);
    const hum = Number(humidityValue);

    if (rain >= 20) return "⛈️";
    if (rain >= 5) return "🌧️";
    if (rain > 0) return "🌦️";
    if (hum >= 85) return "☁️";
    if (hum >= 65) return "🌥️";

    return "☀️";
  };

  // ============================================================
  // RISK HELPERS
  // ============================================================

  const getRisk = (hazard) => {
    if (!hazard) return "LOW";

    return (
      hazard.risk ||
      hazard.status ||
      hazard.level ||
      "LOW"
    );
  };

  const getProbability = (hazard) => {
    if (!hazard) return 0;

    const value =
      hazard.probability ??
      hazard.risk_probability ??
      hazard.prob ??
      hazard.score ??
      0;

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    // If backend gives 0.85 instead of 85
    if (number > 0 && number <= 1) {
      return number * 100;
    }

    return number;
  };

  const getRiskClass = (risk) => {
    switch (String(risk).toUpperCase()) {
      case "VERY HIGH":
      case "SEVERE":
        return "risk-very-high";

      case "HIGH":
        return "risk-high";

      case "MEDIUM":
        return "risk-medium";

      default:
        return "risk-low";
    }
  };

  // ============================================================
  // ML RISKS
  // ============================================================

  const thunderstorm =
    prediction.thunderstorm || {};

  const cloudburst =
    prediction.cloudburst || {};

  const flashFlood =
    prediction.flashFlood ||
    prediction.flashflood ||
    {};

  const overallRisk =
    prediction.overall?.risk ||
    prediction.overallRisk ||
    prediction.risk ||
    "LOW";

  // ============================================================
  // FORECAST DATA
  // ============================================================

  const buildForecast = () => {
    const forecast = [];

    const times = [
      "Now",
      "+1h",
      "+2h",
      "+3h",
      "+4h",
      "+6h",
    ];

    for (let i = 0; i < times.length; i++) {
      let rainValue = 0;

      if (i === 0) {
        rainValue = Number(
          features.precipitation_mm ??
            features.rain_1h ??
            0
        );
      } else if (i === 1) {
        rainValue = Number(
          features.rain_1h ??
            features.precipitation_1h ??
            0
        );
      } else if (i === 2) {
        rainValue = Number(
          features.rain_3h ??
            features.precipitation_3h ??
            0
        );
      } else if (i === 3) {
        rainValue = Number(
          features.rain_6h ??
            features.precipitation_6h ??
            0
        );
      } else if (i === 4) {
        rainValue = Number(
          features.rain_12h ??
            features.precipitation_12h ??
            0
        );
      } else {
        rainValue = Number(
          features.rain_24h ??
            features.precipitation_24h ??
            0
        );
      }

      if (!Number.isFinite(rainValue)) {
        rainValue = 0;
      }

      const icon = getWeatherIcon(
        rainValue,
        humidity
      );

      forecast.push({
        time: times[i],
        icon,
        rain: rainValue,
        value: `${rainValue.toFixed(1)} mm`,
      });
    }

    return forecast;
  };

  const forecast = buildForecast();

  // ============================================================
  // 2 HOUR FORECAST VALUES
  // ============================================================

  const getForecastTemperature = (hour) => {
    let value = null;

    if (hour === 0) {
      value =
        features.temperature_c ??
        features.t2m ??
        features.temperature;
    }

    if (hour === 1) {
      value =
        features.temperature_1h ??
        features.temperature_1_hour ??
        features.temp_1h ??
        features.forecast_temperature_1h;
    }

    if (hour === 2) {
      value =
        features.temperature_2h ??
        features.temperature_2_hour ??
        features.temp_2h ??
        features.forecast_temperature_2h;
    }

    // Do NOT invent temperature.
    // If backend doesn't provide it, current value is shown.
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      value = temperature;
    }

    return value;
  };

  const getForecastHumidity = (hour) => {
    let value = null;

    if (hour === 0) {
      value = humidity;
    }

    if (hour === 1) {
      value =
        features.humidity_1h ??
        features.relative_humidity_1h ??
        features.forecast_humidity_1h;
    }

    if (hour === 2) {
      value =
        features.humidity_2h ??
        features.relative_humidity_2h ??
        features.forecast_humidity_2h;
    }

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      value = humidity;
    }

    return value;
  };

  // ============================================================
  // HOURLY ML PREDICTION SUPPORT
  // ============================================================

  const getHourlyPrediction = (hour) => {
    /*
      Supports future backend formats such as:

      prediction.hourly[0]
      prediction.hourly[1]
      prediction.hourly[2]

      OR

      prediction.forecast[0]
      prediction.forecast[1]
      prediction.forecast[2]

      OR

      prediction["1h"]
      prediction["2h"]

      If backend does not provide these,
      current ML prediction is used as fallback.
    */

    const hourly =
      prediction.hourly ||
      prediction.forecast ||
      prediction.hourlyPrediction ||
      prediction.hourly_predictions;

    if (Array.isArray(hourly)) {
      return (
        hourly[hour] ||
        {}
      );
    }

    if (hour === 1) {
      return (
        prediction["1h"] ||
        prediction["+1h"] ||
        prediction.oneHour ||
        {}
      );
    }

    if (hour === 2) {
      return (
        prediction["2h"] ||
        prediction["+2h"] ||
        prediction.twoHour ||
        {}
      );
    }

    return {};
  };

  const getHourlyHazard = (
    hour,
    hazardName,
    fallbackHazard
  ) => {
    const hourlyPrediction =
      getHourlyPrediction(hour);

    const hazard =
      hourlyPrediction[hazardName] ||
      hourlyPrediction[
        hazardName === "flashFlood"
          ? "flashflood"
          : hazardName
      ];

    if (hazard) {
      return hazard;
    }

    return fallbackHazard;
  };

  // ============================================================
  // 2 HOUR CARDS DATA
  // ============================================================

  const predictionHours = [
    {
      hour: 0,
      label: "NOW",
      badge: "CURRENT",
      temperature: getForecastTemperature(0),
      humidity: getForecastHumidity(0),
      rain:
        forecast[0]?.rain ?? 0,
      thunderstorm,
      cloudburst,
      flashFlood,
    },

    {
      hour: 1,
      label: "+1 HR",
      badge: "PREDICTED",
      temperature: getForecastTemperature(1),
      humidity: getForecastHumidity(1),
      rain:
        forecast[1]?.rain ?? 0,
      thunderstorm:
        getHourlyHazard(
          1,
          "thunderstorm",
          thunderstorm
        ),
      cloudburst:
        getHourlyHazard(
          1,
          "cloudburst",
          cloudburst
        ),
      flashFlood:
        getHourlyHazard(
          1,
          "flashFlood",
          flashFlood
        ),
    },

    {
      hour: 2,
      label: "+2 HR",
      badge: "AI PREDICTION",
      temperature: getForecastTemperature(2),
      humidity: getForecastHumidity(2),
      rain:
        forecast[2]?.rain ?? 0,
      thunderstorm:
        getHourlyHazard(
          2,
          "thunderstorm",
          thunderstorm
        ),
      cloudburst:
        getHourlyHazard(
          2,
          "cloudburst",
          cloudburst
        ),
      flashFlood:
        getHourlyHazard(
          2,
          "flashFlood",
          flashFlood
        ),
    },
  ];

  // ============================================================
  // FORMAT NUMBER
  // ============================================================

  const formatNumber = (
    value,
    decimals = 1
  ) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "--";
    }

    return number.toFixed(decimals);
  };

  // ============================================================
  // RISK CARD
  // ============================================================

  const PredictionRiskRow = ({
    icon,
    name,
    hazard,
  }) => {
    const risk = getRisk(hazard);

    return (
      <div className="prediction-risk-row">
        <span>
          {icon} {name}
        </span>

        <strong className={getRiskClass(risk)}>
          {risk}
        </strong>
      </div>
    );
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="dashboard-card location-card">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="card-title-row">
        <div>
          <h5>Current Location Details</h5>

          <span className="location-district">
            User Current Location
          </span>
        </div>

        <span className="location-status live-status">
          ● Live
        </span>
      </div>


      {/* ======================================================
          LOCATION + CURRENT WEATHER
      ====================================================== */}

      <div className="location-grid">

        {/* LOCATION */}

        <div className="location-info">

          <div className="info-row">
            <span>Latitude</span>

            <strong>
              {formatNumber(latitude, 4)}°
            </strong>
          </div>

          <div className="info-row">
            <span>Longitude</span>

            <strong>
              {formatNumber(longitude, 4)}°
            </strong>
          </div>

          <div className="info-row">
            <span>Forecast</span>

            <strong>6 Hours</strong>
          </div>

          <div className="info-row">
            <span>Source</span>

            <strong>GFS + XGBoost</strong>
          </div>

        </div>


        {/* CURRENT WEATHER */}

        <div className="current-weather">

          <small>
            Current Weather
          </small>

          <div className="weather-temperature">

            <span className="weather-icon">
              {getWeatherIcon(
                rainfall,
                humidity
              )}
            </span>

            <strong>
              {formatNumber(
                temperature,
                1
              )}°
            </strong>

          </div>

          <span className="weather-condition">
            {weatherCondition}
          </span>

          <div className="weather-extra">

            <span>
              💧 {formatNumber(
                humidity,
                0
              )}%
            </span>

            <span>
              💨 {formatNumber(
                windSpeed,
                1
              )} m/s
            </span>

          </div>

        </div>


        {/* 6 HOUR FORECAST */}

        <div className="forecast">

          <small>
            6 Hour Rainfall Forecast
          </small>

          <div className="forecast-items">

            {forecast.map(
              (item, index) => (
                <div
                  className="forecast-item"
                  key={index}
                >

                  <span className="forecast-time">
                    {item.time}
                  </span>

                  <span className="forecast-icon">
                    {item.icon}
                  </span>

                  <span className="forecast-value">
                    {item.value}
                  </span>

                </div>
              )
            )}

          </div>

        </div>

      </div>


      {/* ======================================================
          NEXT 2 HOURS AI EARLY WARNING
      ====================================================== */}

      <div className="two-hour-prediction">

        <div className="two-hour-header">

          <div>

            <div className="two-hour-title">
              AI Early Warning
            </div>

            <div className="two-hour-subtitle">
              Severe weather prediction for the next 2 hours
            </div>

          </div>

          <div className="prediction-engine">

            <span className="prediction-dot"></span>

            XGBoost AI

          </div>

        </div>


        {/* ====================================================
            3 TIMELINE CARDS
        ==================================================== */}

        <div className="prediction-timeline">

          {predictionHours.map(
            (item) => {

              const condition =
                getWeatherCondition(
                  item.rain,
                  item.humidity
                );

              const icon =
                getWeatherIcon(
                  item.rain,
                  item.humidity
                );

              return (
                <div
                  key={item.hour}
                  className={`prediction-card ${
                    item.hour === 0
                      ? "current"
                      : ""
                  } ${
                    item.hour === 2
                      ? "prediction-two-hour"
                      : ""
                  }`}
                >

                  {/* TIME */}

                  <div className="prediction-time">
                    {item.label}
                  </div>


                  {/* BADGE */}

                  <div
                    className={`${
                      item.hour === 0
                        ? "prediction-now-badge"
                        : "prediction-ai-badge"
                    } ${
                      item.hour === 2
                        ? "warning"
                        : ""
                    }`}
                  >
                    {item.badge}
                  </div>


                  {/* WEATHER */}

                  <div className="prediction-weather-icon">
                    {icon}
                  </div>

                  <div className="prediction-temperature">
                    {formatNumber(
                      item.temperature,
                      1
                    )}°
                  </div>

                  <div className="prediction-condition">
                    {condition}
                  </div>

                  <div className="prediction-rain">
                    🌧️{" "}
                    {formatNumber(
                      item.rain,
                      1
                    )} mm
                  </div>


                  <div className="prediction-divider"></div>


                  {/* HAZARD RISKS */}

                  <div className="prediction-risk-list">

                    <PredictionRiskRow
                      icon="⛈️"
                      name="Thunderstorm"
                      hazard={
                        item.thunderstorm
                      }
                    />

                    <PredictionRiskRow
                      icon="🌧️"
                      name="Cloudburst"
                      hazard={
                        item.cloudburst
                      }
                    />

                    <PredictionRiskRow
                      icon="🌊"
                      name="Flash Flood"
                      hazard={
                        item.flashFlood
                      }
                    />

                  </div>

                </div>
              );
            }
          )}

        </div>


        {/* ====================================================
            EARLY WARNING MESSAGE
        ==================================================== */}

        <div className="prediction-warning">

          <div className="prediction-warning-icon">
            ⚡
          </div>

          <div>

            <strong>
              2-Hour Early Warning Window
            </strong>

            <p>
              AI continuously analyzes
              atmospheric conditions to
              identify severe weather risk
              before it develops.
            </p>

          </div>

        </div>

      </div>


      {/* ======================================================
          WEATHER METRICS
      ====================================================== */}

      <div className="location-metrics">

        <div className="metric-box">
          <span>
            🌡️ Temperature
          </span>

          <strong>
            {formatNumber(
              temperature,
              1
            )}°C
          </strong>
        </div>

        <div className="metric-box">
          <span>
            💧 Humidity
          </span>

          <strong>
            {formatNumber(
              humidity,
              0
            )}%
          </strong>
        </div>

        <div className="metric-box">
          <span>
            💨 Wind
          </span>

          <strong>
            {formatNumber(
              windSpeed,
              1
            )} m/s
          </strong>
        </div>

        <div className="metric-box">
          <span>
            🌧️ Rain
          </span>

          <strong>
            {formatNumber(
              rainfall,
              1
            )} mm
          </strong>
        </div>

      </div>


      {/* ======================================================
          ML WARNING
      ====================================================== */}

      <div className="location-warning">

        <div className="warning-header">

          <div>

            <h6>
              AI Weather Risk Analysis
            </h6>

            <small>
              XGBoost prediction
            </small>

          </div>

          <span
            className={`overall-risk ${getRiskClass(
              overallRisk
            )}`}
          >
            {overallRisk}
          </span>

        </div>


        <div className="risk-grid">

          {/* THUNDERSTORM */}

          <div className="risk-item">

            <div className="risk-item-top">

              <span>
                ⛈️ Thunderstorm
              </span>

              <strong
                className={getRiskClass(
                  getRisk(thunderstorm)
                )}
              >
                {getRisk(thunderstorm)}
              </strong>

            </div>

            <div className="risk-progress">

              <div
                className="risk-progress-fill"
                style={{
                  width: `${Math.min(
                    getProbability(
                      thunderstorm
                    ),
                    100
                  )}%`,
                }}
              />

            </div>

            <small>
              {formatNumber(
                getProbability(
                  thunderstorm
                ),
                2
              )}
              % probability
            </small>

          </div>


          {/* CLOUDBURST */}

          <div className="risk-item">

            <div className="risk-item-top">

              <span>
                🌧️ Cloudburst
              </span>

              <strong
                className={getRiskClass(
                  getRisk(cloudburst)
                )}
              >
                {getRisk(cloudburst)}
              </strong>

            </div>

            <div className="risk-progress">

              <div
                className="risk-progress-fill"
                style={{
                  width: `${Math.min(
                    getProbability(
                      cloudburst
                    ),
                    100
                  )}%`,
                }}
              />

            </div>

            <small>
              {formatNumber(
                getProbability(
                  cloudburst
                ),
                2
              )}
              % probability
            </small>

          </div>


          {/* FLASH FLOOD */}

          <div className="risk-item">

            <div className="risk-item-top">

              <span>
                🌊 Flash Flood
              </span>

              <strong
                className={getRiskClass(
                  getRisk(flashFlood)
                )}
              >
                {getRisk(flashFlood)}
              </strong>

            </div>

            <div className="risk-progress">

              <div
                className="risk-progress-fill"
                style={{
                  width: `${Math.min(
                    getProbability(
                      flashFlood
                    ),
                    100
                  )}%`,
                }}
              />

            </div>

            <small>
              {formatNumber(
                getProbability(
                  flashFlood
                ),
                2
              )}
              % probability
            </small>

          </div>

        </div>

      </div>


      {/* ======================================================
          UPDATE INFO
      ====================================================== */}

      <div className="location-footer">

        <span>
          🛰️ Live atmospheric data
        </span>

        <span>
          📍 User current location
        </span>

        <span>
          ⚡ 2-hour AI early warning
        </span>

        <span>
          ↻ Auto refresh: 5 min
        </span>

      </div>

    </div>
  );
}

export default LocationDetails;