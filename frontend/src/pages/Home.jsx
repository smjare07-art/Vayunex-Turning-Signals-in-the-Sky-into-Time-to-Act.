import Navbar from "../components/Navbar";
import WeatherMap from "../components/WeatherMap";
import WindMap from "./WindMap";
import LocationDetails from "../components/LocationDetails";
import AlertAreas from "../components/AlertAreas";
import Nowcast from "../components/Nowcast";

function Home() {
  return (
    <>
      <Navbar />
        <WeatherMap/>
      <LocationDetails />
      <AlertAreas />
      <Nowcast />
    </>
  );
}

export default Home;