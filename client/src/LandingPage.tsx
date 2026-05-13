
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div id="LandingPage">
      <Header />

      <section className="landing-intro" aria-labelledby="landing-title">
        <div>
          <h1 id="landing-title" className="color-primary">
            Map Itinerary
          </h1>
          <p>
            Map Itinerary lets you create a dynamic travel plan by adding
            locations directly on the map and managing tasks tied to each place.
            Whether you're planning a solo adventure or coordinating with
            friends, our app provides a seamless way to organize your trip and
            collaborate in real time.
          </p>
          <button
            className="cta-button"
            onClick={() => navigate("/app")}
          >
            Go to App
          </button>
        </div>
        <div className="screenshot-container">
          <img
            src="/map-itinerary-sample.webp"
            alt="Map Itinerary sample screenshot"
            className="landing-screenshot"
            tabIndex={0}
            style={{ cursor: "pointer", maxWidth: "80%", borderRadius: "8px", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
            onClick={() => setModalOpen(true)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") setModalOpen(true);
            }}
            aria-label="Show screenshot fullscreen"
          />
          {modalOpen && (
            <div
              className="screenshot-modal"
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              onClick={() => setModalOpen(false)}
            >
              <button
                className="modal-close"
                aria-label="Close screenshot"
                onClick={e => {
                  e.stopPropagation();
                  setModalOpen(false);
                }}
              >
                ×
              </button>
              <img
                src="/map-itinerary-sample.webp"
                alt="Map Itinerary sample screenshot fullscreen"
                className="modal-screenshot"
                style={{
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  borderRadius: "12px",
                  boxShadow: "0 4px 32px rgba(0,0,0,0.25)"
                }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </section>

      <section className="landing-features" aria-label="Core features">
        <article className="landing-card">
          <h2>No profile required!</h2>
          <p>
            Creating a trip generates unique Owner and Guest IDs, allowing you
            to manage access without the need for accounts or logins.
          </p>
        </article>
        <article className="landing-card">
          <h2>Owner and guest access</h2>
          <p>
            Protect edit access with Owner ID while sharing progress with Guest
            ID.
          </p>
        </article>
        <article className="landing-card">
          <h2>Live collaboration</h2>
          <p>
            Guests receive updates in real time whenever owners modify trip
            data.
          </p>
        </article>
      </section>

      <section className="landing-how-it-works" aria-label="How it works">
        <h2 className="color-primary">How It Works</h2>
        <p>
          Create or join a trip using your unique Owner or Guest ID. Select any
          location on the map to start adding tasks and collaborating in real
          time.
        </p>
        <div className="details">
          <article className="details-card">
            <h3>Create a trip</h3>
            <ul>
              <li>Creating a trip generates unique Owner and Guest IDs</li>
              <li>Share the Owner ID if you want co-ownership collaboration</li>
              <li>
                Share the Guest ID for others to view the trip in real-time
              </li>
            </ul>
          </article>
          <article className="details-card">
            <h3>Owner ID</h3>
            <ul>
              <li>Allows adding, editing and deleting locations and tasks</li>
            </ul>
          </article>
          <article className="details-card">
            <h3>Guest ID</h3>
            <ul>
              <li>Read only access to a created trip</li>
              <li>
                Can view locations and tasks in real time as the owner makes
                updates
              </li>
            </ul>
          </article>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
