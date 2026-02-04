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
                            if (!session) window.location.reload(); // Reload to exit guest mode
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
