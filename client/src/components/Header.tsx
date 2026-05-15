import { useNavigate } from "react-router-dom";
import "./Header.css";

export const Header = () => {
  const navigate = useNavigate();
  return (
    <header id="Header">
      <div className="header-title">
        <img src="/icon-128.webp" alt="Map itinerary logo" />
        <h1 className="color-primary">MapItin</h1>
      </div>
      <button className="cta-button" onClick={() => navigate("/app")}>
        Try it now
      </button>
    </header>
  );
};
