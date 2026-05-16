import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import "./LandingPage.css";

const LandingPage = () => {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const previousDescription = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");
    const previousRobots = document
      .querySelector('meta[name="robots"]')
      ?.getAttribute("content");
    const previousCanonical = document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute("href");
    const previousOgTitle = document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content");
    const previousOgDescription = document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content");
    const previousOgUrl = document
      .querySelector('meta[property="og:url"]')
      ?.getAttribute("content");
    const previousOgImage = document
      .querySelector('meta[property="og:image"]')
      ?.getAttribute("content");
    const previousTwitterCard = document
      .querySelector('meta[name="twitter:card"]')
      ?.getAttribute("content");
    const previousTwitterTitle = document
      .querySelector('meta[name="twitter:title"]')
      ?.getAttribute("content");
    const previousTwitterDescription = document
      .querySelector('meta[name="twitter:description"]')
      ?.getAttribute("content");
    const previousTwitterImage = document
      .querySelector('meta[name="twitter:image"]')
      ?.getAttribute("content");

    const applyMetaTag = (
      selector: string,
      attributeName: "name" | "property",
      attributeValue: string,
      content: string,
    ) => {
      let element = document.querySelector<HTMLMetaElement>(selector);

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attributeName, attributeValue);
        element.dataset.routeSeo = "landing";
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    const applyCanonicalLink = (href: string) => {
      let element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", "canonical");
        element.dataset.routeSeo = "landing";
        document.head.appendChild(element);
      }

      element.setAttribute("href", href);
    };

    const siteTitle = "MapItin | Collaborative Travel Planning";
    const siteDescription =
      "Plan trips on an interactive map, organize location-based tasks, and collaborate with travelers in real time using owner and guest trip access.";
    const canonicalUrl = new URL("/", window.location.origin).toString();
    const shareImageUrl = new URL(
      "/map-itinerary-sample.webp",
      window.location.origin,
    ).toString();

    document.title = siteTitle;
    applyMetaTag(
      'meta[name="description"]',
      "name",
      "description",
      siteDescription,
    );
    applyMetaTag('meta[name="robots"]', "name", "robots", "index,follow");
    applyCanonicalLink(canonicalUrl);

    applyMetaTag('meta[property="og:title"]', "property", "og:title", siteTitle);
    applyMetaTag(
      'meta[property="og:description"]',
      "property",
      "og:description",
      siteDescription,
    );
    applyMetaTag('meta[property="og:type"]', "property", "og:type", "website");
    applyMetaTag('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    applyMetaTag(
      'meta[property="og:image"]',
      "property",
      "og:image",
      shareImageUrl,
    );

    applyMetaTag('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    applyMetaTag('meta[name="twitter:title"]', "name", "twitter:title", siteTitle);
    applyMetaTag(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      siteDescription,
    );
    applyMetaTag(
      'meta[name="twitter:image"]',
      "name",
      "twitter:image",
      shareImageUrl,
    );

    const structuredData = document.createElement("script");
    structuredData.type = "application/ld+json";
    structuredData.dataset.routeSeo = "landing";
    structuredData.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "MapItin",
      description: siteDescription,
      applicationCategory: "TravelApplication",
      operatingSystem: "Web",
      url: canonicalUrl,
      image: shareImageUrl,
    });
    document.head.appendChild(structuredData);

    return () => {
      document.title = previousTitle;

      const restoreMeta = (selector: string, previousValue: string | null | undefined) => {
        const element = document.querySelector<HTMLMetaElement>(selector);

        if (!element) {
          return;
        }

        if (previousValue == null) {
          if (element.dataset.routeSeo === "landing") {
            element.remove();
          }

          return;
        }

        element.setAttribute("content", previousValue);
      };

      restoreMeta('meta[name="description"]', previousDescription);
      restoreMeta('meta[name="robots"]', previousRobots);
      restoreMeta('meta[property="og:title"]', previousOgTitle);
      restoreMeta('meta[property="og:description"]', previousOgDescription);
      restoreMeta('meta[property="og:url"]', previousOgUrl);
      restoreMeta('meta[property="og:image"]', previousOgImage);
      restoreMeta('meta[name="twitter:card"]', previousTwitterCard);
      restoreMeta('meta[name="twitter:title"]', previousTwitterTitle);
      restoreMeta('meta[name="twitter:description"]', previousTwitterDescription);
      restoreMeta('meta[name="twitter:image"]', previousTwitterImage);

      const canonicalElement = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

      if (canonicalElement) {
        if (previousCanonical == null) {
          if (canonicalElement.dataset.routeSeo === "landing") {
            canonicalElement.remove();
          }
        } else {
          canonicalElement.setAttribute("href", previousCanonical);
        }
      }

      document
        .querySelectorAll('[data-route-seo="landing"]')
        .forEach((element) => {
          if (element.tagName === "META" || element.tagName === "LINK") {
            return;
          }

          element.remove();
        });
    };
  }, []);

  return (
    <div id="LandingPage">
      <Header />

      <section className="landing-intro" aria-labelledby="landing-title">
        <div>
          <h1 id="landing-title">
            <span className="color-primary">Map</span><span className="color-graphite">Itin(erary)</span>
          </h1>
          <p>
            MapItin allows you to create dynamic travel itineraries by adding
            locations directly on a map and managing tasks tied to each
            location.
          </p>
          <p>
            Whether you're planning a solo adventure or coordinating with
            friends, our app provides a seamless way to organize your trip and
            collaborate with fellow travelers in real time.
          </p>
          <Link className="cta-button" to="/app">
            Try now
          </Link>
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
