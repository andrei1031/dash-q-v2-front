import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

// --- Chart.js Imports ---
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// THEMES PROVIDER
import { ThemeProvider } from './Components/Providers/ThemeProvider';

// COMPONENT
import { BarberAppLayout } from './Components/BarberAppLayout';
import { AdminAppLayout } from './Components/AdminAppLayout';
import { CustomerAppLayout } from './Components/CustomerAppLayout';
import { LandingPage } from './Components/LandingPage';
import { AdminLoginForm } from './Components/AdminLoginForm';

// HTTP-COMMONS
import { API_URL } from './Components/http-commons';
// SUPABASE
import { supabase } from './Components/supabase';
// NOTIFICATIONS
import { registerPushNotifications } from './Components/notifications/registerPushNotifications';
// AUTHENTICATIONS
import { AuthForm } from './Components/authentication/AuthForm';
import { UpdatePasswordForm } from './Components/authentication/UpdatePasswordForm';

// --- SOUND NOTIFICATION SETUP ---
export const queueNotificationSound = new Audio('/queue_sound.mp3');
export const messageNotificationSound = new Audio('/chat_sound.mp3');



// --- Global Constants ---
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Add this inside App() or specific layouts (BarberAppLayout / CustomerAppLayout)

export const handleLogout = async (userId) => {
    // 1. Clear Server Availability Flag (Barbers only)
    if (userId) {
        try {
            await axios.put(`${API_URL}/logout/flag`, { userId });
            console.log("Server status updated successfully.");
        } catch (error) {
            console.warn("Warning: Failed to clear barber availability status on server.", error.message);
        }
    }

    // 2. CHECK SESSION BEFORE SIGNING OUT
    // This prevents the "403 Forbidden" error if the token is already dead.
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
            console.warn("Supabase signout warning:", signOutError.message);
        }
    } else {
        console.log("Session already expired. Clearing local state only.");
    }

    // 3. Force Local Cleanup (Always do this)
    localStorage.clear(); // Clear all app state (IDs, queue position, etc)
    
    // Force a "hard" session clear in Supabase client just in case
    await supabase.auth.setSession({ access_token: 'expired', refresh_token: 'expired' });
    
    // Reload to reset all React states cleanly
    window.location.reload();
};

// ##############################################
// ##           MAIN APP COMPONENT           ##
// ##############################################
function App() {
    const [session, setSession] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [barberProfile, setBarberProfile] = useState(null);
    const [loadingRole, setLoadingRole] = useState(true);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    
    // --- NEW STATE: Controls Landing Page visibility ---
    const [showLanding, setShowLanding] = useState(true); 
    const [showAdminLogin, setShowAdminLogin] = useState(false);

    // --- Helper to Check Role ---
    const checkUserRole = useCallback(async (user) => {
        if (!user || !user.id) {
            setUserRole('customer');
            setBarberProfile(null);
            setLoadingRole(false);
            return;
        }

        console.log(`Checking role for user: ${user.id}`);
        setLoadingRole(true);
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            
            if (profileData && profileData.role === 'admin') {
                setUserRole('admin');
                setBarberProfile(null);
                setLoadingRole(false);
                return; 
            }

            const response = await axios.get(`${API_URL}/barber/profile/${user.id}`);
            setUserRole('barber');
            setBarberProfile(response.data);

        } catch (error) {
            setUserRole('customer');
            setBarberProfile(null);
        } finally {
            setLoadingRole(false);
        }
    }, []);

    // --- Auth Listener ---
    // --- REPLACE YOUR EXISTING useEffect IN App() WITH THIS ---
    useEffect(() => {
        const initSession = async () => {
            // 1. TOKEN RECOVERY (Make it Token Based)
            // Explicitly check for an existing session in local storage to prevent flicker
            const { data: { session: existingSession } } = await supabase.auth.getSession();
            if (existingSession) {
                setSession(existingSession);
                checkUserRole(existingSession.user);
            }
            setLoadingRole(false);

            // 2. SAFER NOTIFICATION CHECK (Prevents Mobile Crash)
            // Only run if the browser actually supports it
            if ('Notification' in window && 'serviceWorker' in navigator && existingSession?.user?.id) {
                if (Notification.permission === 'granted') {
                    // Only register if we ALREADY have permission. 
                    // NEVER ask for permission here (it crashes mobile).
                    registerPushNotifications(existingSession.user.id);
                }
            }
        };

        initSession();

        // 3. Listen for Auth Changes (Login/Logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            setSession(currentSession);
            if (currentSession?.user) {
                checkUserRole(currentSession.user);
            } else {
                setUserRole('customer'); // Default reset
                setBarberProfile(null);
            }
        });

        return () => subscription?.unsubscribe();
    }, [checkUserRole]);

    useEffect(() => {
        if (!supabase?.auth) {
            setLoadingRole(false);
            return;
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            if (_event === 'PASSWORD_RECOVERY') {
                setIsUpdatingPassword(true);
            }

            setSession(currentSession);

            if (currentSession?.user) {
                // User is logged in, hide landing page immediately
                setShowLanding(false); 
                checkUserRole(currentSession.user);
            } else {
                setUserRole('customer');
                setBarberProfile(null);
                setLoadingRole(false);
                setIsUpdatingPassword(false);
                // Note: We do NOT reset showLanding to true here. 
                // If they logout, we show AuthForm (Login) by default, unless they refresh.
            }
        });

        return () => subscription?.unsubscribe();
    }, [checkUserRole]);
    
    // --- Render Logic ---
    const renderAppContent = () => {
        // 1. Loading State
        if (loadingRole) return <div className="loading-fullscreen"><span>Loading...</span></div>;
        
        // 2. Password Reset
        if (isUpdatingPassword) return <UpdatePasswordForm onPasswordUpdated={() => setIsUpdatingPassword(false)} />;
        
        // 3. Authenticated View
        if (session) {
            if (userRole === 'admin') return <AdminAppLayout session={session} />;
            if (userRole === 'barber' && barberProfile) return <BarberAppLayout session={session} barberProfile={barberProfile} setBarberProfile={setBarberProfile} />;
            return <CustomerAppLayout session={session} />;
        }

        // 4. ADMIN LOGIN (New Section)
        if (showAdminLogin) {
            return <AdminLoginForm onCancel={() => setShowAdminLogin(false)} />;
        }

        // 5. Landing Page
        if (showLanding) {
            return (
                <LandingPage 
                    onGetStarted={() => setShowLanding(false)} 
                    onLogin={() => setShowLanding(false)} 
                    onAdminClick={() => { setShowLanding(false); setShowAdminLogin(true); }} // <--- Pass handler
                />
            );
        }

        // 6. Login/Signup Form (Unified Design)
        return (
            <div className="auth-page-container">
                {/* Navigation Bar (Top Left) */}
                <nav className="auth-nav">
                    <button 
                        onClick={() => setShowLanding(true)} 
                        className="btn btn-link btn-back-home"
                    >
                        ← Back to Home
                    </button>
                </nav>
                
                {/* Centered Content */}
                <div className="auth-content">
                    <AuthForm />
                    {/* Discrete Admin Link at the bottom */}
                    <div style={{marginTop: '30px', textAlign: 'center'}}>
                        <button 
                            onClick={() => setShowAdminLogin(true)} 
                            className="btn btn-link" 
                            style={{fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.5}}
                        >
                            Admin Access
                        </button>
                    </div>
                    {/* Optional: Small branding footer under the card */}
                    <p style={{
                        marginTop: '20px', 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.85rem', 
                        opacity: 0.7
                    }}>
                        Dash-Q &copy; 2025
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ThemeProvider>
            {renderAppContent()}
        </ThemeProvider>
    );
}

export default App;