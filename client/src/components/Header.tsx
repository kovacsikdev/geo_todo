import { Link } from "react-router-dom";
import "./Header.css";

export const Header = () => {
  return (
    <header id="Header">
      <div className="header-title">
        <img src="/logo-128.png" alt="Map itinerary logo" />
        <h1>
          <span className="color-primary">Map</span>
          <span className="color-graphite">Itin</span>
        </h1>
      </div>
      <Link className="cta-button" to="/app">
        Try now
      </Link>
    </header>
  );
};
