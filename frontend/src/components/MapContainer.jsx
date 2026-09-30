<MapContainer
  center={[19.2, 75.5]}
  zoom={6}
  minZoom={5}
  maxZoom={12}
  style={{ height: "100%", width: "100%" }}
>

  <TileLayer
    attribution='&copy; OpenStreetMap contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />

  {/* =========================================
      MAHARASHTRA DISTRICT BOUNDARIES
  ========================================= */}

  <MaharashtraDistrictBoundaries
    districtData={districtData}
    normalizeDistrictName={normalizeDistrictName}
    getRiskColor={getRiskColor}
  />


  {/* =========================================
      YOUR EXISTING CIRCLE MARKERS
  ========================================= */}

  {/* existing markers इथेच राहू दे */}


</MapContainer>