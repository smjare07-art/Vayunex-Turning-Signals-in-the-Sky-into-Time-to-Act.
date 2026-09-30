import React, { useEffect, useRef, useState } from "react";

import {
  MapContainer,
  TileLayer,
  ZoomControl,
  CircleMarker,
  Popup,
  useMapEvents,
  useMap,
  GeoJSON,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./WeatherMap.css";

// ============================================================
// API
// ============================================================

const API_URL = "http://localhost:8081";

// ============================================================
// OPEN-METEO FORECAST API
// Used only for next 6 hour forecast
// ============================================================

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// ============================================================
// MAP CLICK HANDLER
// ============================================================

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (event) => {
      const { lat, lng } = event.latlng;

      onMapClick(lat, lng);
    },
  });

  return null;
}

// ============================================================
// LEAFLET MAP SIZE FIX
// ============================================================
function MapSizeFix() {
  const map = useMap();

  useEffect(() => {
    const refreshMapSize = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch (error) {
        console.warn("Leaflet map resize warning:", error);
      }
    };

    setTimeout(refreshMapSize, 100);
    setTimeout(refreshMapSize, 500);
    setTimeout(refreshMapSize, 1000);

    window.addEventListener("resize", refreshMapSize);

    return () => {
      window.removeEventListener("resize", refreshMapSize);
    };
  }, [map]);

  return null;
}

// ============================================================
// RISK CONFIGURATION
// ============================================================

const RISK_CONFIG = {
  "VERY HIGH": {
    label: "Severe",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.45)",
    radius: 15,
  },

  SEVERE: {
    label: "Severe",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.45)",
    radius: 15,
  },

  HIGH: {
    label: "High",
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.42)",
    radius: 13,
  },

  MEDIUM: {
    label: "Medium",
    color: "#eab308",
    glow: "rgba(234, 179, 8, 0.42)",
    radius: 11,
  },

  LOW: {
    label: "Low",
    color: "#22c55e",
    glow: "rgba(34, 197, 94, 0.40)",
    radius: 9,
  },
};

// ============================================================
// NORMALIZE RISK
// ============================================================

function normalizeRisk(risk) {
  if (!risk) {
    return "LOW";
  }

  const value = String(risk).trim().toUpperCase();

  if (value === "SEVERE") {
    return "SEVERE";
  }

  if (value === "VERY HIGH") {
    return "VERY HIGH";
  }

  if (value === "HIGH") {
    return "HIGH";
  }

  if (value === "MEDIUM" || value === "MED") {
    return "MEDIUM";
  }

  return "LOW";
}

// ============================================================
// GET RISK CONFIG
// ============================================================

function getRiskConfig(risk) {
  const normalized = normalizeRisk(risk);

  return RISK_CONFIG[normalized] || RISK_CONFIG.LOW;
}

// ============================================================
// EXTRACT LOCATIONS
// ============================================================

function extractLocations(result) {
  const locations = [];

  // ----------------------------------------------------------
  // ZONES
  // ----------------------------------------------------------

  if (result && result.zones && typeof result.zones === "object") {
    Object.entries(result.zones).forEach(([zoneName, zoneDistricts]) => {
      if (!Array.isArray(zoneDistricts)) {
        return;
      }

      zoneDistricts.forEach((district) => {
        locations.push({
          ...district,

          zone: district.zone || district.zoneName || zoneName,
        });
      });
    });
  }

  // ----------------------------------------------------------
  // DATA ARRAY
  // ----------------------------------------------------------

  if (locations.length === 0 && Array.isArray(result?.data)) {
    result.data.forEach((item) => {
      locations.push(item);
    });
  }

  // ----------------------------------------------------------
  // DISTRICTS ARRAY
  // ----------------------------------------------------------

  if (locations.length === 0 && Array.isArray(result?.districts)) {
    result.districts.forEach((item) => {
      locations.push(item);
    });
  }

  // ----------------------------------------------------------
  // DIRECT ARRAY
  // ----------------------------------------------------------

  if (locations.length === 0 && Array.isArray(result)) {
    result.forEach((item) => {
      locations.push(item);
    });
  }

  return locations;
}

// ============================================================
// LOCATION NAME
// ============================================================

function getLocationName(location) {
  return (
    location?.district ||
    location?.district_name ||
    location?.name ||
    location?.location ||
    location?.city ||
    "Selected Location"
  );
}

// ============================================================
// GET FEATURES
// ============================================================

function getFeatures(location) {
  return (
    location?.features || location?.weather || location?.currentWeather || {}
  );
}

// ============================================================
// GET PREDICTION
// ============================================================

function getPrediction(location, activeWeather) {
  if (!location) {
    return null;
  }

  const prediction = location.prediction || location.predictions || {};

  switch (activeWeather) {
    case "Thunderstorm":
      return prediction.thunderstorm || location.thunderstorm || prediction;

    case "Cloudburst":
      return prediction.cloudburst || location.cloudburst || prediction;

    case "Flash Flood":
      return (
        prediction.flashFlood ||
        prediction.flash_flood ||
        location.flashFlood ||
        prediction
      );

    default:
      return prediction.thunderstorm || prediction;
  }
}

// ============================================================
// GET RISK
// ============================================================

function getLocationRisk(location, activeWeather) {
  const prediction = getPrediction(location, activeWeather);

  if (location?.risk) {
    return normalizeRisk(location.risk);
  }

  if (prediction?.risk) {
    return normalizeRisk(prediction.risk);
  }

  return "LOW";
}

// ============================================================
// GET PROBABILITY
// ============================================================

function getProbability(location, activeWeather) {
  const prediction = getPrediction(location, activeWeather);

  if (
    prediction?.probability !== undefined &&
    prediction?.probability !== null
  ) {
    return Number(prediction.probability);
  }

  if (prediction?.probability_percent !== undefined) {
    return Number(prediction.probability_percent);
  }

  if (location?.probability !== undefined) {
    return Number(location.probability);
  }

  return null;
}

// ============================================================
// GET RAW PROBABILITY
// ============================================================

function getRawProbability(location, activeWeather) {
  const prediction = getPrediction(location, activeWeather);

  if (prediction?.raw_probability !== undefined) {
    return Number(prediction.raw_probability);
  }

  if (prediction?.rawProbability !== undefined) {
    return Number(prediction.rawProbability);
  }

  return null;
}

// ============================================================
// FORMAT NUMBER
// ============================================================

function formatNumber(value, decimals = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  return number.toFixed(decimals);
}

// ============================================================
// GET RAINFALL
// ============================================================

function getRainfall(location) {
  const features = getFeatures(location);

  return (
    features.precipitation_mm ??
    features.rain_mm ??
    features.precipitation ??
    features.rainfall_mm ??
    features.rain_1h ??
    features.rain ??
    location?.precipitation_mm ??
    location?.rainfall_mm ??
    location?.rainfall ??
    0
  );
}

// ============================================================
// GET TEMPERATURE
// ============================================================

function getTemperature(location) {
  const features = getFeatures(location);

  return (
    features.temperature_c ??
    features.temperature_2m ??
    features.temperature ??
    features.temp_c ??
    features.t2m ??
    location?.temperature_c ??
    location?.temperature ??
    null
  );
}

// ============================================================
// GET HUMIDITY
// ============================================================

function getHumidity(location) {
  const features = getFeatures(location);

  return (
    features.relative_humidity ??
    features.humidity_percent ??
    features.relative_humidity_2m ??
    features.humidity ??
    features.rh ??
    location?.relative_humidity ??
    location?.humidity ??
    null
  );
}

// ============================================================
// GET WIND SPEED
// ============================================================

function getWindSpeed(location) {
  const features = getFeatures(location);

  return (
    features.wind_speed_10m ??
    features.wind_speed_kmh ??
    features.wind_speed ??
    features.windSpeed ??
    location?.wind_speed ??
    location?.windSpeed ??
    null
  );
}

// ============================================================
// GET WIND DIRECTION
// ============================================================

function getWindDirection(location) {
  const features = getFeatures(location);

  return (
    features.wind_direction_10m ??
    features.wind_direction_deg ??
    features.wind_direction ??
    features.windDirection ??
    null
  );
}

// ============================================================
// WIND DIRECTION → COMPASS
// ============================================================

function getWindCompass(direction) {
  const degrees = Number(direction);

  if (!Number.isFinite(degrees)) {
    return "--";
  }

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  const index = Math.round(degrees / 45) % 8;

  return directions[index];
}

// ============================================================
// WEATHER CONDITION
// ============================================================

function getWeatherCondition(location) {
  const rainfall = Number(getRainfall(location));

  const humidity = Number(getHumidity(location));

  if (rainfall >= 20) {
    return "Heavy Rain";
  }

  if (rainfall >= 5) {
    return "Rain";
  }

  if (rainfall > 0) {
    return "Light Rain";
  }

  if (humidity >= 85) {
    return "Cloudy";
  }

  if (humidity >= 65) {
    return "Partly Cloudy";
  }

  return "Clear";
}

// ============================================================
// WEATHER ICON
// ============================================================

function getWeatherIcon(location) {
  const rainfall = Number(getRainfall(location));

  const humidity = Number(getHumidity(location));

  if (rainfall >= 20) {
    return "⛈️";
  }

  if (rainfall >= 5) {
    return "🌧️";
  }

  if (rainfall > 0) {
    return "🌦️";
  }

  if (humidity >= 85) {
    return "☁️";
  }

  if (humidity >= 65) {
    return "🌥️";
  }

  return "☀️";
}

// ============================================================
// PAST RAINFALL
// ============================================================

function getPastRainfall(location) {
  const features = getFeatures(location);

  return {
    last1h: features.rain_1h ?? features.precipitation_1h ?? null,

    last3h: features.rain_3h ?? features.precipitation_3h ?? null,

    last6h: features.rain_6h ?? features.precipitation_6h ?? null,

    last12h: features.rain_12h ?? features.precipitation_12h ?? null,

    last24h: features.rain_24h ?? features.precipitation_24h ?? null,
  };
}

// ============================================================
// NORMALIZE DISTRICT NAME
// ============================================================

function normalizeDistrictName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/district/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// ============================================================
// GET GEOJSON DISTRICT NAME
// ============================================================

function getGeoJSONDistrictName(feature) {
  const properties = feature?.properties || {};

  return (
    properties.district ||
    properties.DISTRICT ||
    properties.District ||
    properties.district_name ||
    properties.DISTRICT_NAME ||
    properties.NAME_2 ||
    properties.NAME ||
    properties.name ||
    properties.dtname ||
    properties.DT_NAME ||
    ""
  );
}

// ============================================================
// GET DISTRICT GEOJSON RISK
// ============================================================

function getDistrictGeoRisk(feature, locations, activeWeather) {
  const geoName = normalizeDistrictName(getGeoJSONDistrictName(feature));

  if (!geoName) {
    return "LOW";
  }

  const matchedLocation = locations.find((location) => {
    const locationName = normalizeDistrictName(getLocationName(location));

    return (
      locationName === geoName ||
      locationName.includes(geoName) ||
      geoName.includes(locationName)
    );
  });

  return matchedLocation
    ? getLocationRisk(matchedLocation, activeWeather)
    : "LOW";
}

// ============================================================
// DISTRICT OPACITY
// ============================================================

function getDistrictFillOpacity(risk) {
  switch (normalizeRisk(risk)) {
    case "VERY HIGH":
    case "SEVERE":
      return 0.42;

    case "HIGH":
      return 0.36;

    case "MEDIUM":
      return 0.32;

    case "LOW":
    default:
      return 0.24;
  }
}

// ============================================================
// DISTRICT STYLE
// ============================================================

function getDistrictStyle(feature, locations, activeWeather) {
  const risk = getDistrictGeoRisk(feature, locations, activeWeather);

  const config = getRiskConfig(risk);

  return {
    color: "#ffffff",

    weight: 1.4,

    opacity: 0.9,

    fillColor: config.color,

    fillOpacity: getDistrictFillOpacity(risk),
  };
}

// ============================================================
// FORMAT FORECAST TIME
// ============================================================

function formatForecastTime(isoTime) {
  if (!isoTime) {
    return "--";
  }

  const date = new Date(isoTime);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// FETCH NEXT 6 HOUR FORECAST
// ============================================================

async function fetchSixHourForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),

    longitude: String(longitude),

    hourly: [
      "precipitation",
      "temperature_2m",
      "relative_humidity_2m",
      "wind_speed_10m",
      "wind_direction_10m",
    ].join(","),

    forecast_hours: "7",

    timezone: "auto",

    wind_speed_unit: "kmh",
  });

  const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Forecast API returned ${response.status}`);
  }

  const result = await response.json();

  const hourly = result?.hourly;

  if (!hourly || !Array.isArray(hourly.time)) {
    return [];
  }

  const forecast = [];

  // index 0 = current hour
  // index 1..6 = next six hours

  for (let i = 1; i <= 6; i++) {
    if (!hourly.time[i]) {
      continue;
    }

    forecast.push({
      time: hourly.time[i],

      rainfall: Number(hourly.precipitation?.[i] ?? 0),

      temperature: Number(hourly.temperature_2m?.[i] ?? NaN),

      humidity: Number(hourly.relative_humidity_2m?.[i] ?? NaN),

      windSpeed: Number(hourly.wind_speed_10m?.[i] ?? NaN),

      windDirection: Number(hourly.wind_direction_10m?.[i] ?? NaN),
    });
  }

  return forecast;
}

// ============================================================
// WEATHER POPUP COMPONENT
// ============================================================

function WeatherPopupContent({
  location,
  isClickedLocation = false,
  forecastLoading = false,
  forecast = [],
  forecastError = "",
  activeWeather = "Thunderstorm",
}) {
  if (!location) {
    return null;
  }

  const rainfall = getRainfall(location);

  const temperature = getTemperature(location);

  const humidity = getHumidity(location);

  const windSpeed = getWindSpeed(location);

  const windDirection = getWindDirection(location);

  const compass = getWindCompass(windDirection);

  const condition = getWeatherCondition(location);

  const weatherIcon = getWeatherIcon(location);

  const risk = getLocationRisk(location, activeWeather);

  const config = getRiskConfig(risk);

  const probability = getProbability(location, activeWeather);

  const rawProbability = getRawProbability(location, activeWeather);

  const prediction = getPrediction(location, activeWeather);

  const pastRain = getPastRainfall(location);

  const latitude = Number(location.lat ?? location.latitude);

  const longitude = Number(location.lon ?? location.lng ?? location.longitude);

  const locationName = getLocationName(location);

  return (
    <div className="risk-popup-content">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="popup-header">
        <div>
          <div className="popup-location-name">{locationName}</div>

          <div className="popup-subtitle">
            {isClickedLocation
              ? "Selected Map Location"
              : "Live Weather Information"}
          </div>
        </div>

        <div
          className="popup-risk-badge"
          style={{
            backgroundColor: config.color,
          }}
        >
          {config.label}
        </div>
      </div>

      <div className="popup-divider" />

      {/* =====================================================
          CURRENT WEATHER
      ===================================================== */}

      <div className="popup-section-title">🌦️ Current Weather</div>

      <div className="popup-weather-main">
        <span className="popup-weather-icon">{weatherIcon}</span>

        <div>
          <div className="popup-temperature">
            {formatNumber(temperature, 1)}

            {temperature !== null ? "°C" : ""}
          </div>

          <div className="popup-condition">{condition}</div>
        </div>
      </div>

      {/* =====================================================
          CURRENT WEATHER METRICS
      ===================================================== */}

      <div className="popup-weather-grid">
        <div className="popup-weather-box">
          <span>🌧️ Rainfall</span>

          <strong>{formatNumber(rainfall, 1)} mm</strong>
        </div>

        <div className="popup-weather-box">
          <span>💧 Humidity</span>

          <strong>{formatNumber(humidity, 0)}%</strong>
        </div>

        <div className="popup-weather-box">
          <span>💨 Wind Speed</span>

          <strong>{formatNumber(windSpeed, 1)} km/h</strong>
        </div>

        <div className="popup-weather-box">
          <span>🧭 Wind Direction</span>

          <strong>
            {windDirection !== null
              ? `${formatNumber(windDirection, 0)}° ${compass}`
              : "--"}
          </strong>
        </div>
      </div>

      {/* =====================================================
          PAST RAINFALL
      ===================================================== */}

      <div className="popup-section-title">🌧️ Rainfall History</div>

      <div className="popup-rain-grid">
        <div>
          <span>Last 1h</span>

          <strong>
            {pastRain.last1h !== null
              ? `${formatNumber(pastRain.last1h, 1)} mm`
              : "--"}
          </strong>
        </div>

        <div>
          <span>Last 3h</span>

          <strong>
            {pastRain.last3h !== null
              ? `${formatNumber(pastRain.last3h, 1)} mm`
              : "--"}
          </strong>
        </div>

        <div>
          <span>Last 6h</span>

          <strong>
            {pastRain.last6h !== null
              ? `${formatNumber(pastRain.last6h, 1)} mm`
              : "--"}
          </strong>
        </div>
      </div>

      {/* =====================================================
          NEXT 6 HOURS
      ===================================================== */}

      <div className="popup-section-title">🔮 Next 6 Hours Rainfall</div>

      {forecastLoading ? (
        <div className="popup-loading">
          <span className="popup-loading-spinner"></span>
          Loading next 6 hour forecast...
        </div>
      ) : forecastError ? (
        <div className="popup-forecast-error">⚠️ {forecastError}</div>
      ) : forecast.length === 0 ? (
        <div className="popup-forecast-error">Forecast unavailable</div>
      ) : (
        <div className="popup-forecast-grid">
          {forecast.map((item, index) => (
            <div className="popup-forecast-item" key={`${item.time}-${index}`}>
              <span>{formatForecastTime(item.time)}</span>

              <strong>{formatNumber(item.rainfall, 1)} mm</strong>

              <small>{formatNumber(item.temperature, 0)}°</small>
            </div>
          ))}
        </div>
      )}

      {/* =====================================================
          TOTAL NEXT 6 HOURS
      ===================================================== */}

      {forecast.length > 0 && (
        <div className="popup-total-rain">
          <span>🌧️ Total Next 6h</span>

          <strong>
            {formatNumber(
              forecast.reduce(
                (total, item) => total + (Number(item.rainfall) || 0),

                0,
              ),

              1,
            )}{" "}
            mm
          </strong>
        </div>
      )}

      {/* =====================================================
          AI WEATHER RISK
      ===================================================== */}

      <div className="popup-divider" />

      <div className="popup-section-title">🤖 AI Weather Risk Analysis</div>

      <div className="popup-info-row">
        <span className="popup-label">Hazard</span>

        <strong>{activeWeather}</strong>
      </div>

      <div className="popup-info-row">
        <span className="popup-label">Risk Level</span>

        <strong
          style={{
            color: config.color,
          }}
        >
          {config.label}
        </strong>
      </div>

      {probability !== null && (
        <div className="popup-info-row">
          <span className="popup-label">Probability</span>

          <strong>{formatNumber(probability, 2)}%</strong>
        </div>
      )}

      {rawProbability !== null && (
        <div className="popup-raw-probability">
          Model probability: {(rawProbability * 100).toFixed(4)}%
        </div>
      )}

      {/* =====================================================
          ALL HAZARD RISKS
      ===================================================== */}

      <div className="popup-all-risks">
        <div className="popup-all-risk-row">
          <span>⛈️ Thunderstorm</span>

          <strong
            style={{
              color: getRiskConfig(
                normalizeRisk(location?.prediction?.thunderstorm?.risk),
              ).color,
            }}
          >
            {normalizeRisk(location?.prediction?.thunderstorm?.risk)}
          </strong>
        </div>

        <div className="popup-all-risk-row">
          <span>☁️ Cloudburst</span>

          <strong
            style={{
              color: getRiskConfig(
                normalizeRisk(location?.prediction?.cloudburst?.risk),
              ).color,
            }}
          >
            {normalizeRisk(location?.prediction?.cloudburst?.risk)}
          </strong>
        </div>

        <div className="popup-all-risk-row">
          <span>🌊 Flash Flood</span>

          <strong
            style={{
              color: getRiskConfig(
                normalizeRisk(location?.prediction?.flashFlood?.risk),
              ).color,
            }}
          >
            {normalizeRisk(location?.prediction?.flashFlood?.risk)}
          </strong>
        </div>
      </div>

      {/* =====================================================
          COORDINATES
      ===================================================== */}

      <div className="popup-location-coordinates">
        📍 {Number.isFinite(latitude) ? latitude.toFixed(5) : "--"},{" "}
        {Number.isFinite(longitude) ? longitude.toFixed(5) : "--"}
      </div>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {prediction?.message && (
        <div className="popup-message">{prediction.message}</div>
      )}

      {prediction?.reason && (
        <div className="popup-message">{prediction.reason}</div>
      )}

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <div className="popup-footer">
        <span className="popup-live-dot"></span>
        XGBoost Weather Risk Data
      </div>
    </div>
  );
}

// ============================================================
// WEATHER MAP
// ============================================================

function WeatherMap() {
  const [weatherData, setWeatherData] = useState([]);

  const [districtGeoJSON, setDistrictGeoJSON] = useState(null);

  const [activeWeather, setActiveWeather] = useState("Thunderstorm");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  // ----------------------------------------------------------
  // CLICKED LOCATION
  // ----------------------------------------------------------

  const [clickedLocation, setClickedLocation] = useState(null);

  const requestIdRef = useRef(0);

  // ==========================================================
  // LOAD MAHARASHTRA GEOJSON
  // ==========================================================

  useEffect(() => {
    let isMounted = true;

    const loadDistrictBoundaries = async () => {
      try {
        const response = await fetch("/maharashtra-districts.geojson");

        if (!response.ok) {
          throw new Error(`District GeoJSON Error: ${response.status}`);
        }

        const geojson = await response.json();

        if (isMounted) {
          setDistrictGeoJSON(geojson);
        }
      } catch (err) {
        console.error("Unable to load Maharashtra district boundaries:", err);
      }
    };

    loadDistrictBoundaries();

    return () => {
      isMounted = false;
    };
  }, []);

  // ==========================================================
  // LOAD DISTRICT ML DATA
  // DEMO-SAFE VERSION
  // ==========================================================
  useEffect(() => {
    let isMounted = true;

    const fetchWeatherData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Loading Maharashtra ML data...");

        const response = await fetch(`${API_URL}/api/ml/maharashtra`);

        if (!response.ok) {
          throw new Error(`Maharashtra ML API Error: ${response.status}`);
        }

        const result = await response.json();

        console.log("MAHARASHTRA ML DATA:", result);

        const locations = extractLocations(result);

        console.log("DISTRICTS / LOCATIONS FOUND:", locations);

        if (!Array.isArray(locations)) {
          throw new Error("Invalid Maharashtra ML data format");
        }

        const safeLocations = locations
          .map((location) => {
            const lat = Number(location?.lat ?? location?.latitude);

            const lon = Number(
              location?.lon ?? location?.lng ?? location?.longitude,
            );

            return {
              ...location,
              lat,
              lon,
              latitude: location?.latitude ?? location?.lat ?? lat,
              longitude:
                location?.longitude ?? location?.lon ?? location?.lng ?? lon,
              district:
                location?.district ??
                location?.district_name ??
                location?.name ??
                location?.location ??
                "Unknown",
            };
          })
          .filter(
            (location) =>
              Number.isFinite(location.lat) && Number.isFinite(location.lon),
          );

        console.log("SAFE MAP LOCATIONS:", safeLocations.length);

        // IMPORTANT: do not call /api/ml/district/:district for
        // every location here. That caused many simultaneous GFS
        // requests and Open-Meteo rate-limit errors.
        if (isMounted) {
          setWeatherData(safeLocations);
          setError(null);
        }
      } catch (err) {
        console.error("Maharashtra ML data error:", err);

        if (isMounted) {
          // Do not clear the map if live weather temporarily fails.
          setError("Live weather temporarily unavailable");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchWeatherData();

    const interval = setInterval(fetchWeatherData, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // ==========================================================
  // MAP CLICK
  // ==========================================================

  const handleMapClick = async (latitude, longitude) => {
    const requestId = ++requestIdRef.current;

    // ------------------------------------------------------
    // OPEN POPUP IMMEDIATELY
    // ------------------------------------------------------

    setClickedLocation({
      lat: latitude,

      lon: longitude,

      loading: true,

      error: "",

      data: null,

      forecast: [],

      forecastLoading: true,

      forecastError: "",
    });

    try {
      // ----------------------------------------------------
      // BACKEND ML WEATHER
      // ----------------------------------------------------

      const backendUrl =
        `${API_URL}/api/ml/location` +
        `?lat=${encodeURIComponent(latitude)}` +
        `&lon=${encodeURIComponent(longitude)}`;

      // ----------------------------------------------------
      // OPEN-METEO NEXT 6 HOURS
      // ----------------------------------------------------

      const forecastPromise = fetchSixHourForecast(latitude, longitude);

      const backendPromise = fetch(backendUrl);

      const [backendResponse, forecastResult] = await Promise.all([
        backendPromise,
        forecastPromise,
      ]);

      // ----------------------------------------------------
      // CHECK REQUEST IS STILL CURRENT
      // ----------------------------------------------------

      if (requestId !== requestIdRef.current) {
        return;
      }

      // ----------------------------------------------------
      // BACKEND RESPONSE
      // ----------------------------------------------------

      if (!backendResponse.ok) {
        let message = `Server returned ${backendResponse.status}`;

        try {
          const errorData = await backendResponse.json();

          if (errorData?.message) {
            message = errorData.message;
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const backendData = await backendResponse.json();

      if (!backendData.success) {
        throw new Error(
          backendData.message || "Unable to load selected location",
        );
      }

      // ----------------------------------------------------
      // BUILD LOCATION OBJECT
      // ----------------------------------------------------

      const locationData = {
        ...backendData,

        lat: backendData.latitude ?? latitude,

        lon: backendData.longitude ?? longitude,

        latitude: backendData.latitude ?? latitude,

        longitude: backendData.longitude ?? longitude,

        district: backendData.district || "Selected Location",
      };

      // ----------------------------------------------------
      // UPDATE POPUP
      // ----------------------------------------------------

      setClickedLocation({
        lat: latitude,

        lon: longitude,

        loading: false,

        error: "",

        data: locationData,

        forecast: forecastResult,

        forecastLoading: false,

        forecastError: "",
      });
    } catch (err) {
      console.error("Selected location weather error:", err);

      if (requestId !== requestIdRef.current) {
        return;
      }

      // ----------------------------------------------------
      // BACKEND MAY FAIL BUT FORECAST MAY WORK
      // ----------------------------------------------------

      try {
        const forecast = await fetchSixHourForecast(latitude, longitude);

        if (requestId !== requestIdRef.current) {
          return;
        }

        setClickedLocation({
          lat: latitude,

          lon: longitude,

          loading: false,

          error: err.message || "Weather data unavailable",

          data: null,

          forecast,

          forecastLoading: false,

          forecastError: "",
        });
      } catch (forecastError) {
        setClickedLocation({
          lat: latitude,

          lon: longitude,

          loading: false,

          error: err.message || "Weather data unavailable",

          data: null,

          forecast: [],

          forecastLoading: false,

          forecastError: forecastError.message,
        });
      }
    }
  };

  // ==========================================================
  // WEATHER FILTERS
  // ==========================================================

  const weatherButtons = [
    {
      name: "Thunderstorm",
      icon: "⛈️",
    },

    {
      name: "Cloudburst",
      icon: "☁️",
    },

    {
      name: "Flash Flood",
      icon: "🌊",
    },
  ];

  // ==========================================================
  // VALID LOCATIONS
  // ==========================================================

  const validLocations = weatherData.filter((location) => {
    const lat = Number(location.lat ?? location.latitude);

    const lon = Number(location.lon ?? location.lng ?? location.longitude);

    return Number.isFinite(lat) && Number.isFinite(lon);
  });

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalLocations = validLocations.length;

  const severeCount = validLocations.filter((location) => {
    const risk = getLocationRisk(location, activeWeather);

    return risk === "VERY HIGH" || risk === "SEVERE";
  }).length;

  const highCount = validLocations.filter(
    (location) => getLocationRisk(location, activeWeather) === "HIGH",
  ).length;

  const mediumCount = validLocations.filter(
    (location) => getLocationRisk(location, activeWeather) === "MEDIUM",
  ).length;

  const lowCount = validLocations.filter(
    (location) => getLocationRisk(location, activeWeather) === "LOW",
  ).length;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="weather-map-wrapper">
      {/* ======================================================
          WEATHER FILTERS
      ====================================================== */}

      <div className="weather-filter-panel">
        {weatherButtons.map((button) => (
          <button
            type="button"
            key={button.name}
            className={
              activeWeather === button.name
                ? "weather-filter-btn active"
                : "weather-filter-btn"
            }
            onClick={(event) => {
              event.stopPropagation();

              setActiveWeather(button.name);
            }}
          >
            <span className="weather-filter-icon">{button.icon}</span>

            <span>{button.name}</span>
          </button>
        ))}
      </div>

      {/* ======================================================
          ACTIVE WEATHER
      ====================================================== */}

      <div className="active-weather-badge">
        <span className="active-live-dot"></span>

        <span>Live {activeWeather} Risk</span>
      </div>

      {/* ======================================================
          MAP DATA STATUS
      ====================================================== */}

      <div className="map-data-status">
        {loading ? (
          <>
            <span className="status-spinner"></span>
            Loading live weather data...
          </>
        ) : error ? (
          <>
            <span className="status-warning">⚠</span>

            {error}
          </>
        ) : (
          <>
            <span className="status-online-dot"></span>
            {totalLocations} locations monitored
            <span className="status-separator">•</span>
            <span className="status-severe">{severeCount} severe</span>
            <span className="status-separator">•</span>
            <span className="status-high">{highCount} high</span>
          </>
        )}
      </div>

      {/* ======================================================
          RISK LEGEND
      ====================================================== */}

      <div className="risk-legend">
        <div className="legend-title">
          <span>Risk Level</span>

          <span className="legend-live">LIVE</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot severe"></span>

          <span>Severe</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot high"></span>

          <span>High</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot medium"></span>

          <span>Medium</span>
        </div>

        <div className="legend-item">
          <span className="legend-dot low"></span>

          <span>Low</span>
        </div>
      </div>

      {/* ======================================================
          RISK SUMMARY
      ====================================================== */}

      {!loading && validLocations.length > 0 && (
        <div className="risk-summary">
          <div className="summary-item">
            <span className="summary-dot severe"></span>

            <span>{severeCount}</span>
          </div>

          <div className="summary-item">
            <span className="summary-dot high"></span>

            <span>{highCount}</span>
          </div>

          <div className="summary-item">
            <span className="summary-dot medium"></span>

            <span>{mediumCount}</span>
          </div>

          <div className="summary-item">
            <span className="summary-dot low"></span>

            <span>{lowCount}</span>
          </div>
        </div>
      )}

      {/* ======================================================
          MAP
      ====================================================== */}

      <MapContainer
        center={[19.2, 75.5]}
        zoom={6}
        minZoom={5}
        maxZoom={12}
        zoomControl={false}
        scrollWheelZoom={true}
        className="weather-map"
      >
        <MapSizeFix />

        {/* ====================================================
            OPEN STREET MAP
        ==================================================== */}

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ====================================================
            CLICK ANY LOCATION
        ==================================================== */}

        <MapClickHandler onMapClick={handleMapClick} />

        {/* ====================================================
            MAHARASHTRA DISTRICT RISK
        ==================================================== */}

        {districtGeoJSON && (
          <GeoJSON
            key={`district-risk-${activeWeather}-${weatherData.length}`}
            data={districtGeoJSON}
            style={(feature) =>
              getDistrictStyle(feature, validLocations, activeWeather)
            }
            onEachFeature={(feature, layer) => {
              const districtName = getGeoJSONDistrictName(feature);

              const risk = getDistrictGeoRisk(
                feature,
                validLocations,
                activeWeather,
              );

              const config = getRiskConfig(risk);

              layer.bindTooltip(
                `${districtName || "District"} • ${config.label}`,

                {
                  sticky: true,

                  direction: "top",

                  className: "district-risk-tooltip",
                },
              );

              layer.on({
                mouseover: (event) => {
                  event.target.setStyle({
                    weight: 2.5,

                    color: "#ffffff",

                    fillOpacity: Math.min(
                      getDistrictFillOpacity(risk) + 0.1,
                      0.55,
                    ),
                  });

                  event.target.bringToFront();
                },

                mouseout: (event) => {
                  event.target.setStyle(
                    getDistrictStyle(feature, validLocations, activeWeather),
                  );
                },
              });
            }}
          />
        )}

        {/* ====================================================
            ACTUAL DISTRICT ML MARKERS
            NO DEMO ZONES
        ==================================================== */}

        {validLocations.map((location, index) => {
          const lat = Number(location.lat ?? location.latitude);

          const lon = Number(
            location.lon ?? location.lng ?? location.longitude,
          );

          const locationName = getLocationName(location);

          const risk = getLocationRisk(location, activeWeather);

          const config = getRiskConfig(risk);

          const prediction = getPrediction(location, activeWeather);

          const probability = getProbability(location, activeWeather);

          const rawProbability = getRawProbability(location, activeWeather);

          const rainfall = getRainfall(location);

          const temperature = getTemperature(location);

          const humidity = getHumidity(location);

          const windSpeed = getWindSpeed(location);

          const windDirection = getWindDirection(location);

          const pastRain = getPastRainfall(location);

          const condition = getWeatherCondition(location);

          const weatherIcon = getWeatherIcon(location);

          return (
            <React.Fragment key={`${locationName}-${lat}-${lon}-${index}`}>
              {/* ==========================================
                    OUTER GLOW
                ========================================== */}

              <CircleMarker
                center={[lat, lon]}
                radius={config.radius + 7}
                pathOptions={{
                  color: config.color,

                  fillColor: config.color,

                  fillOpacity: 0.1,

                  opacity: 0.3,

                  weight: 1,
                }}
                interactive={false}
              />

              {/* ==========================================
                    MAIN MARKER
                ========================================== */}

              <CircleMarker
                center={[lat, lon]}
                radius={config.radius}
                pathOptions={{
                  color: "#ffffff",

                  weight: 3,

                  fillColor: config.color,

                  fillOpacity: 0.96,
                }}
              >
                <Popup className="risk-popup">
                  <WeatherPopupContent
                    location={location}
                    activeWeather={activeWeather}
                  />
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* ====================================================
            CLICKED LOCATION POPUP
        ==================================================== */}

        {clickedLocation && (
          <CircleMarker
            center={[clickedLocation.lat, clickedLocation.lon]}
            radius={10}
            pathOptions={{
              color: "#ffffff",

              weight: 3,

              fillColor: "#2563eb",

              fillOpacity: 1,
            }}
          >
            <Popup className="risk-popup" autoPan={true} closeButton={true}>
              {clickedLocation.loading ? (
                <div className="risk-popup-content">
                  <div className="popup-header">
                    <div>
                      <div className="popup-location-name">
                        Selected Location
                      </div>

                      <div className="popup-subtitle">
                        Loading live weather...
                      </div>
                    </div>
                  </div>

                  <div className="popup-loading">
                    <span className="popup-loading-spinner"></span>
                    Fetching weather data...
                  </div>

                  <div className="popup-location-coordinates">
                    📍 {clickedLocation.lat.toFixed(5)},{" "}
                    {clickedLocation.lon.toFixed(5)}
                  </div>
                </div>
              ) : clickedLocation.data ? (
                <WeatherPopupContent
                  location={clickedLocation.data}
                  isClickedLocation={true}
                  forecast={clickedLocation.forecast}
                  forecastLoading={clickedLocation.forecastLoading}
                  forecastError={clickedLocation.forecastError}
                  activeWeather={activeWeather}
                />
              ) : (
                <div className="risk-popup-content">
                  <div className="popup-header">
                    <div>
                      <div className="popup-location-name">
                        Selected Location
                      </div>

                      <div className="popup-subtitle">Weather unavailable</div>
                    </div>
                  </div>

                  <div className="popup-forecast-error">
                    ⚠️ {clickedLocation.error || "Unable to load weather data"}
                  </div>

                  {clickedLocation.forecast.length > 0 && (
                    <>
                      <div className="popup-section-title">
                        🔮 Next 6 Hours Rainfall
                      </div>

                      <div className="popup-forecast-grid">
                        {clickedLocation.forecast.map((item, index) => (
                          <div className="popup-forecast-item" key={index}>
                            <span>{formatForecastTime(item.time)}</span>

                            <strong>{formatNumber(item.rainfall, 1)} mm</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="popup-location-coordinates">
                    📍 {clickedLocation.lat.toFixed(5)},{" "}
                    {clickedLocation.lon.toFixed(5)}
                  </div>
                </div>
              )}
            </Popup>
          </CircleMarker>
        )}

        {/* ====================================================
            ZOOM
        ==================================================== */}

        <ZoomControl position="bottomright" />
      </MapContainer>
    </section>
  );
}

export default WeatherMap;
