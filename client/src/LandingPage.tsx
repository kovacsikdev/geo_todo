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
            Map Itin(erary)
          </h1>
          <p>
            Map Itin allows you to create dynamic travel itineraries by adding
            locations directly on a map and managing tasks tied to each
            location.
          </p>
          <p>
            Whether you're planning a solo adventure or coordinating with
            friends, our app provides a seamless way to organize your trip and
            collaborate with fellow travelers in real time.
          </p>
          <button className="cta-button" onClick={() => navigate("/app")}>
            Try it now
          </button>
        </div>
        <div className="screenshot-container">
          <img
            src="/map-itinerary-sample.webp"
            alt="Map Itinerary sample screenshot"
            className="landing-screenshot"
            tabIndex={0}
            style={{
              cursor: "pointer",
              maxWidth: "80%",
              borderRadius: "8px",
              boxShadow: "0 0 24px rgba(0,0,0,0.25)",
            }}
            onClick={() => setModalOpen(true)}
            onKeyDown={(e) => {
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
                onClick={(e) => {
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
                  boxShadow: "0 4px 32px rgba(0,0,0,0.25)",
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </section>

      <section className="landing-details" aria-label="Core features">
        <h2 className="color-primary">Features</h2>
        <div className="details">
          <article className="details-card">
            <h2>No profile required!</h2>
            <p>
              Creating a trip generates unique Owner and Guest IDs, allowing you
              to manage access without the need for accounts or logins.
            </p>
          </article>
          <article className="details-card">
            <h2>Secure</h2>
            <p>
              Any trip data is stored in a database so you can access it with
              your IDs whenever you want.
            </p>
            <p>
              You can also delete your trip to permanently remove all trip data
              to keep your privacy.
            </p>
            <p>Your data is never shared with any third parties.</p>
          </article>
          <article className="details-card">
            <h2>Live collaboration</h2>
            <p>
              Guests receive updates in real time whenever owners modify trip
              data.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-details" aria-label="How it works">
        <h2 className="color-primary">How It Works</h2>
        <p>
          Create a new trip or join an existing trip using your unique Owner or
          Guest ID. As an owner, you can add locations by clicking on the map
          and manage tasks.
        </p>
        <div className="details">
          <article className="details-card">
            <h3>Create a trip</h3>
            <p>Creating a trip generates unique Owner and Guest IDs</p>
            <p>Share the Owner ID if you want co-ownership collaboration</p>
            <p>Share the Guest ID for others to view the trip in real-time</p>
          </article>
          <article className="details-card">
            <h3>Owner ID</h3>
            <p>Allows adding, editing and deleting locations and tasks</p>
          </article>
          <article className="details-card">
            <h3>Guest ID</h3>
            <p>Read only access to a created trip</p>
            <p>
              Can view locations and tasks in real time as the owner makes
              updates
            </p>
          </article>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
