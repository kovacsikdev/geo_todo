import { useRouter } from '@tanstack/react-router';
import "./Header.css";

export const Header = () => {
  const router = useRouter();
  return (
    <header id="Header">
      <h1 className="color-primary">Map Itinerary</h1>
      <button className="cta-button" onClick={() => router.navigate({ to: '/app' })}>Go to App</button>
    </header>
  );
}