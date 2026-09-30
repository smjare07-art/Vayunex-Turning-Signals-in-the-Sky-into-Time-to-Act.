import React from "react";

function AboutVeeyom() {

  return (

    <div
      className="dashboard-card about-card"
      id="about"
    >

      <div className="about-header">

        <div>

          <h5>
            About VEEYOM
          </h5>

          <span>
            AI-Driven Hyper-Local Nowcasting
          </span>

        </div>


        <div className="ai-icon">
          ✦
        </div>

      </div>


      <p>

        VEEYOM is an AI-driven hyper-local
        nowcasting system designed to predict
        severe weather events at short time
        horizons.

      </p>


      <p>

        The system integrates weather data,
        satellite information, atmospheric
        parameters and terrain information
        to improve short-term prediction.

      </p>


      <div className="about-tags">

        <span>
          AI / ML
        </span>

        <span>
          IWV
        </span>

        <span>
          DEM
        </span>

        <span>
          Nowcasting
        </span>

      </div>

    </div>

  );
}

export default AboutVeeyom;