import { handleLogout } from "../App";
import { IconLogout } from "./assets/Icon";
import { CustomerView } from "./CustomerView";
import { ThemeToggleButton } from "./Partials/ThemeToggleButton";

// 1. Add installPrompt and setInstallPrompt to the props here
export const CustomerAppLayout = ({ session, installPrompt, setInstallPrompt }) => {
    
    // 2. Add the handler function for the click
    const handleInstallClick = async () => {
        if (!installPrompt) return;
        
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            setInstallPrompt(null); // Hide the button after installation
        }
    };

    return (
        <div className="app-layout customer-app-layout">
            <header className="app-header">
                <h1>Welcome, {session?.user?.user_metadata?.full_name || 'Guest'}!</h1>
                <div className="header-actions">
                    
                    {/* 3. Add the Install Button logic here */}
                    {installPrompt && (
                        <button 
                            onClick={handleInstallClick}
                            className="btn"
                            style={{ 
                                backgroundColor: 'var(--primary-color)', 
                                color: 'white', 
                                padding: '5px 12px', 
                                fontSize: '0.8rem',
                                borderRadius: '20px'
                            }}
                        >
                            Install App
                        </button>
                    )}

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
                    <CustomerView session={session} />
                </div>
            </main>
        </div>
    );
}