import { IconChat, IconCheck, IconNext } from "./assets/Icon";
import { ThemeToggleButton } from "./Partials/ThemeToggleButton";

export const LandingPage = ({ onGetStarted, onLogin, onAdminClick }) => {
    return (
        <div className="landing-container">
            <nav className="landing-nav">
                <div className="landing-logo">
                    <span style={{fontSize: '2rem'}}>⚡</span> Dash-Q
                </div>
                <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                    <ThemeToggleButton />
                    <button onClick={onLogin} className="btn btn-link" style={{color: 'var(--text-primary)', fontWeight: 600}}>
                        Login
                    </button>
                </div>
            </nav>

            <header className="hero-section">
                <h1 className="hero-title" style={{fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1.1, marginBottom: '1rem'}}>
                    Queue Smarter,<br /> <span>Look Sharper.</span>
                </h1>
                <p className="hero-subtitle" style={{fontSize: 'clamp(1rem, 2vw, 1.25rem)', maxWidth: '600px', margin: '0 auto 2rem'}}>
                    Skip the long wait. Join the live queue from anywhere, book appointments, and get notified when it's your turn.
                </p>
                <div className="hero-buttons">
                    <button onClick={onGetStarted} className="btn btn-primary btn-hero">
                        Get Started Now
                    </button>
                    <button onClick={onLogin} className="btn btn-secondary btn-hero">
                        Barber Login
                    </button>
                </div>
            </header>

            <section className="features-section">
                <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div className="feature-card">
                        <div className="feature-icon"><IconNext /></div>
                        <h3>Live Queue Tracking</h3>
                        <p>See exactly how many people are ahead of you and your estimated wait time.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"><IconChat /></div>
                        <h3>Direct Chat</h3>
                        <p>Message your barber directly to clarify styles or delays without leaving the app.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon"><IconCheck /></div>
                        <h3>Hybrid Booking</h3>
                        <p>Join the queue now for a quick cut or schedule an appointment for later.</p>
                    </div>
                </div>
            </section>

            <footer className="landing-footer">
                <p>&copy; 2025 Dash-Q. University of the Cordilleras.</p>
                <div style={{display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px', fontSize: '0.8rem'}}>
                    <span>Developed by Aquino, Galima & Saldivar</span>
                    <span>|</span>
                    <button 
                        onClick={onAdminClick} 
                        style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, font: 'inherit'}}
                    >
                        Admin
                    </button>
                </div>
            </footer>
        </div>
    );
}
