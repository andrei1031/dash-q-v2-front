import { useCallback, useState } from "react";
import { AvailabilityToggle } from "./AvailabilityToggle";
import { ThemeToggleButton } from "./Partials/ThemeToggleButton";
import { handleLogout } from "../App";
import { BarberDashboard } from "./BarberDashboard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { MyReportsModal } from "./modals/MyReportsModal";
import { IconLogout } from "./assets/Icon";

export const BarberAppLayout = ({ session, barberProfile, setBarberProfile }) => {
    const [refreshAnalyticsSignal, setRefreshAnalyticsSignal] = useState(0);
    const [isMyReportsOpen, setIsMyReportsOpen] = useState(false);

    const handleCutComplete = useCallback(() => {
        setRefreshAnalyticsSignal(prev => prev + 1);
    }, []);

    const handleRealtimeUpdate = useCallback(() => {
        console.log("🔄 Realtime event detected! Refreshing stats...");
        setRefreshAnalyticsSignal(prev => prev + 1);
    }, []);

    return (
        <div className="app-layout barber-app-layout">
            <header className="app-header">
                <h1>Welcome, {barberProfile.full_name}!</h1>
                <div className="header-actions">
                    <AvailabilityToggle
                        barberProfile={barberProfile}
                        session={session}
                        onAvailabilityChange={(newStatus) => setBarberProfile(prev => ({ ...prev, is_available: newStatus }))}
                    />
                    <ThemeToggleButton />
                    <button onClick={() => handleLogout(session.user.id)} className="btn btn-icon" title="Logout"><IconLogout /></button>
                </div>
            </header>
            <main className="main-content">
                <div className="container" style={{ maxWidth: '1200px', width: '100%', padding: '20px 15px 40px', boxSizing: 'border-box', margin: '0 auto' }}>
                    <BarberDashboard
                        barberId={barberProfile.id}
                        barberName={barberProfile.full_name}
                        onCutComplete={handleCutComplete}
                        session={session}
                        onQueueUpdate={handleRealtimeUpdate} // <--- PASSING THE TRIGGER DOWN
                    />
                    <AnalyticsDashboard
                        barberId={barberProfile.id}
                        refreshSignal={refreshAnalyticsSignal} // <--- STATS WILL LISTEN TO THIS
                    />
                </div>
            </main>
            <MyReportsModal isOpen={isMyReportsOpen} onClose={() => setIsMyReportsOpen(false)} userId={session.user.id} />
        </div>
    );
}
