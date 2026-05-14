import { useNavigate } from 'react-router-dom';
import "./Header.css";

export const Header = () => {
  const navigate = useNavigate();
  return (
    <header id="Header">
      <h1 className="color-primary">Map Itin</h1>
      <button className="cta-button" onClick={() => navigate('/app')}>Go to App</button>
    </header>
  );
}