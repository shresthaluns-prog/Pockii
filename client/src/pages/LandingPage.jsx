import { Link } from "react-router-dom";

const features = [
  {
    number: "01",
    title: "Know where it goes",
    description: "Bring everyday spending into one clear view and organize it with categories that make sense to you.",
    icon: "↗",
  },
  {
    number: "02",
    title: "Make room for goals",
    description: "Set a budget for the things that matter and keep an eye on how you’re tracking throughout the month.",
    icon: "◎",
  },
  {
    number: "03",
    title: "See the bigger picture",
    description: "Turn your transactions into simple reports that help you spot patterns and plan your next steps.",
    icon: "⌁",
  },
];

function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link aria-label="Pockii home" className="landing-brand" to="/">
          <span aria-hidden="true" className="landing-brand-mark">
            <svg fill="none" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2.5" />
              <path d="M19.5 11.5c-.7-1-2-1.5-3.5-1.5-2 0-3.5 1-3.5 2.5s1.2 2.2 3.5 2.5 3.5 1.1 3.5 2.5-1.5 2.5-3.5 2.5c-1.6 0-3-.6-3.8-1.7M16 8.5v15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </span>
          <span>Pockii</span>
        </Link>
        <nav aria-label="Landing page navigation" className="landing-navigation">
          <Link className="landing-login" to="/auth">Log in</Link>
          <Link className="landing-nav-cta" to="/auth">Get started <span aria-hidden="true">→</span></Link>
        </nav>
      </header>

      <main>
        <section aria-labelledby="landing-title" className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><span aria-hidden="true" /> Your money, a little more clear</p>
            <h1 id="landing-title">Small steps.<br /><span>Smarter money.</span></h1>
            <p className="landing-intro">
              Pockii makes it easier to understand your spending, stick to a budget, and feel good about the choices you make every day.
            </p>
            <div className="landing-actions">
              <Link className="landing-primary-button" to="/auth">Start your free account <span aria-hidden="true">→</span></Link>
              <a className="landing-text-link" href="#features">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="landing-reassurance"><span aria-hidden="true">✓</span> Simple to use <span aria-hidden="true">·</span> Made for your everyday</p>
          </div>

          <div aria-label="Illustration of a personal finance overview" className="landing-preview">
            <div aria-hidden="true" className="landing-orbit landing-orbit-one" />
            <div aria-hidden="true" className="landing-orbit landing-orbit-two" />
            <div className="landing-preview-card">
              <div className="landing-preview-top">
                <div>
                  <p className="landing-preview-label">MONTHLY OVERVIEW</p>
                  <h2>Your money, in view</h2>
                </div>
                <span aria-hidden="true" className="landing-preview-dots">•••</span>
              </div>
              <div className="landing-balance">
                <span>Available this month</span>
                <strong>$2,840<span>.50</span></strong>
                <small><span aria-hidden="true">↗</span> A little more breathing room</small>
              </div>
              <div className="landing-chart">
                <div className="landing-chart-heading"><span>Spending overview</span><span>Last 6 months</span></div>
                <svg aria-hidden="true" fill="none" viewBox="0 0 440 118">
                  <path d="M0 94H440M0 58H440M0 22H440" stroke="#e9f0f1" strokeDasharray="4 5" />
                  <path d="M7 80C34 72 46 86 76 69s39-12 63-23 42 17 70 3 35-30 62-22 41 16 62 2 38-20 58-13 31 1 42-9v98H7V80Z" fill="url(#chart-fill)" />
                  <path d="M7 80C34 72 46 86 76 69s39-12 63-23 42 17 70 3 35-30 62-22 41 16 62 2 38-20 58-13 31 1 42-9" stroke="#159d9e" strokeLinecap="round" strokeWidth="3" />
                  <defs>
                    <linearGradient id="chart-fill" x1="220" x2="220" y1="8" y2="108" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#159d9e" stopOpacity=".19" />
                      <stop offset="1" stopColor="#159d9e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div aria-hidden="true" className="landing-chart-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
              </div>
              <div className="landing-budget">
                <div className="landing-budget-icon" aria-hidden="true">⌂</div>
                <div className="landing-budget-copy"><strong>Everyday budget</strong><span>You’re right on track</span></div>
                <div aria-hidden="true" className="landing-budget-status"><span /></div>
              </div>
            </div>
            <div aria-hidden="true" className="landing-float-note"><span>✦</span> One step at a time</div>
          </div>
        </section>

        <section aria-labelledby="features-title" className="landing-features" id="features">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">A calmer way to manage money</p>
            <h2 id="features-title">Clarity for your everyday.</h2>
            <p>All the essentials to make your money feel a little less complicated.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map((feature) => (
              <article className="landing-feature-card" key={feature.number}>
                <div className="landing-feature-card-top">
                  <span className="landing-feature-icon" aria-hidden="true">{feature.icon}</span>
                  <span className="landing-feature-number">{feature.number}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-bottom-cta">
          <div>
            <p className="landing-eyebrow">Your next small step starts here</p>
            <h2>Feel more at ease with your money.</h2>
          </div>
          <Link className="landing-primary-button" to="/auth">Get started with Pockii <span aria-hidden="true">→</span></Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Link aria-label="Pockii home" className="landing-brand" to="/">
          <span aria-hidden="true" className="landing-brand-mark">
            <svg fill="none" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2.5" />
              <path d="M19.5 11.5c-.7-1-2-1.5-3.5-1.5-2 0-3.5 1-3.5 2.5s1.2 2.2 3.5 2.5 3.5 1.1 3.5 2.5-1.5 2.5-3.5 2.5c-1.6 0-3-.6-3.8-1.7M16 8.5v15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </span>
          <span>Pockii</span>
        </Link>
        <p>Small steps. Smarter money.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
