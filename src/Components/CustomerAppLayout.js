import { handleLogout } from "../App";
import { IconLogout } from "./assets/Icon";
import { CustomerView } from "./CustomerView";
import { ThemeToggleButton } from "./Partials/ThemeToggleButton";


export const CustomerAppLayout = ({ session }) => {
    return (
        <div className="app-layout customer-app-layout">
            <header className="app-header">
                <h1>Welcome, {session?.user?.user_metadata?.full_name || 'Guest'}!</h1>
                <div className="header-actions">
                    <ThemeToggleButton />
                    <button 
                        onClick={() => {
                            if (!session) window.location.reload(); 
                            else handleLogout(session.user.id);
                        }} 
                        className="btn btn-icon" 
                        title={session ? "Logout" : "Exit Guest Mode"}
                    >
                        <IconLogout />
                    </button>
                </div>
            </header>
            <main className="main-content">
                <div className="container" style={{ maxWidth: '1200px', width: '100%', padding: '20px 15px 40px', boxSizing: 'border-box', margin: '0 auto' }}>
                    
                    {/* 1. The Main Customer View (Queue Status, etc.) */}
                    <CustomerView session={session} />

                    {/* =================================================== */}
                    {/* 👇 STEP 2: INSERTED GUEST KIOSK BUTTON HERE 👇 */}
                    {/* =================================================== */}
                    {session?.user?.is_guest && (
                        <div className="guest-kiosk-controls" style={{
                            marginTop: '40px',
                            padding: '30px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle background
                            border: '2px dashed var(--border-color, #ccc)', // Uses theme var or default gray
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <h3 style={{marginTop: 0, marginBottom: '10px'}}>Next Customer?</h3>
                            <p style={{marginBottom: '20px', color: 'var(--text-secondary, #888)'}}>
                                If you have successfully joined the queue, click below to let the next person use this device.
                            </p>
                            <button 
                                onClick={() => handleLogout(session.user.id)}
                                className="btn btn-primary"
                                style={{
                                    padding: '12px 24px',
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                    minWidth: '220px',
                                    cursor: 'pointer'
                                }}
                            >
                                ➕ Queue Next Person
                            </button>
                        </div>
                    )}
                    {/* =================================================== */}
                    
                </div>
            </main>
        </div>
    );
}