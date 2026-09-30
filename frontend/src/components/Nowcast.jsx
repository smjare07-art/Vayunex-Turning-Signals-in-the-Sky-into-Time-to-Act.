import React from "react";

function Nowcast() {

  const events = [

    {
      title: "Thunderstorm",
      icon: "⛈️",
      description:
        "Thunderstorm in Tehri in 4h",
      probability: "85%",
      className: "thunderstorm"
    },

    {
      title: "Cloudburst",
      icon: "☁️",
      description:
        "Cloudburst in Tehri in 4h",
      probability: "85%",
      className: "cloudburst"
    },

    {
      title: "Flash Flood",
      icon: "🌊",
      description:
        "Flash Flood in Tehri in 4h",
      probability: "85%",
      className: "flashflood"
    }

  ];


  return (

    <section className="nowcast-section">


      <div className="section-heading">

        <div>

          <h5>
            2–6 Hour Severe Weather Nowcast
          </h5>

          <p>
            AI-based short-term severe weather prediction
          </p>

        </div>

        <span className="forecast-badge">
          NEXT 6 HOURS
        </span>

      </div>


      <div className="nowcast-grid">

        {events.map(
          (event, index) => (

            <div
              className={
                `nowcast-card ${event.className}`
              }

              key={index}
            >

              <div className="nowcast-icon">
                {event.icon}
              </div>


              <div className="nowcast-info">

                <h6>
                  {event.title}
                </h6>

                <p>
                  {event.description}
                </p>


                <div className="probability">

                  <span>
                    Probability
                  </span>

                  <strong>
                    {event.probability}
                  </strong>

                </div>

              </div>

            </div>

          )
        )}

      </div>

    </section>

  );
}

export default Nowcast;