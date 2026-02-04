import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../http-commons";
import { supabase } from "../supabase";
import { ThemeToggleButton } from "../Partials/ThemeToggleButton";
import { IconEye, IconEyeOff } from "../assets/Icon";
import { SignUpModal } from "../modals/SignUpModal";
import { ForgotPassword } from "./ForgotPassword";

export const AuthForm = ({ onGuestLogin, initialRole }) => {
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [barberCode, setBarberCode] = useState('');
    const [pin, setPin] = useState('');

    const [authView, setAuthView] = useState('login'); // 'login', 'signup', or 'forgotPassword'

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedRole, setSelectedRole] = useState(initialRole || 'customer');
    const [showPassword, setShowPassword] = useState(false);
    const [showGuestModal, setShowGuestModal] = useState(false);

    useEffect(() => {
        if (initialRole) {
            setSelectedRole(initialRole);
        }
    }, [initialRole]);

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true); setMessage('');
        try {
            if (authView === 'login') {
                if (!username || !password) throw new Error("Username/password required.");
                if (selectedRole === 'barber' && !pin) throw new Error("Barber PIN required.");
                const response = await axios.post(`${API_URL}/login/username`, { username: username.trim(), password, role: selectedRole, pin: selectedRole === 'barber' ? pin : undefined });
                if (response.data.user?.email && supabase?.auth) {
                    const { error } = await supabase.auth.signInWithPassword({ email: response.data.user.email, password });
                    if (error) throw error;
                } else { throw new Error("Login failed: Invalid server response."); }
            } else { // This is now just for 'signup'
                if (!email.trim() || !fullName.trim()) throw new Error("Email/Full Name required.");
                if (selectedRole === 'barber' && !barberCode.trim()) throw new Error("Barber Code required.");
                const response = await axios.post(`${API_URL}/signup/username`, { username: username.trim(), email: email.trim(), password, fullName: fullName.trim(), role: selectedRole, barberCode: selectedRole === 'barber' ? barberCode.trim() : undefined });
                setMessage(response.data.message || 'Account created! You can now log in.');
                setAuthView('login');
                setUsername(''); setEmail(''); setPassword(''); setFullName(''); setBarberCode(''); setPin(''); setSelectedRole('customer');
            }
        } catch (error) { console.error('Auth error:', error); setMessage(`Authentication failed: ${error.response?.data?.error || error.message || 'Unexpected error.'}`); }
        finally { setLoading(false); }
    };
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (!email) throw new Error("Email is required.");
            const trimmedEmail = email.trim();

            console.log(`Checking if email ${trimmedEmail} exists...`);
            
            // 1. SECURELY CHECK IF EMAIL EXISTS
            const checkResponse = await axios.post(`${API_URL}/check-email`, { email: trimmedEmail });
            
            // 2. LOGIC SPLIT: If email is NOT found, throw a clean, display-ready error.
            if (!checkResponse.data.found) {
                console.log("Email not found, throwing specific display error.");
                // Throw an error that we can catch below
                throw new Error(`The email address "${trimmedEmail}" is not registered.`); 
            }

            // 3. If found, proceed with the actual password reset link generation via Supabase.
            console.log("Email found. Sending reset link via Supabase...");
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                redirectTo: window.location.origin,
            });
            
            if (resetError) {
                if (resetError.message.includes('rate limit')) {
                    throw new Error('Email rate limit exceeded. Please wait a moment.');
                }
                throw resetError; 
            }

            // 4. Show SUCCESS message 
            // NOTE: The word 'sent' here triggers the success class in the JSX below.
            setMessage('Success! Check your email. The password reset link has been sent.');
            
            setTimeout(() => {
                setAuthView('login');
                setEmail('');
                setMessage('');
            }, 3000);

        } catch (error) {
            console.error('Forgot password exception:', error);
            
            // NEW LOGIC: Extract and display a clean message.
            let clientMessage = '';
            
            if (error.message.includes('not registered')) {
                    // Custom user error: Display the clean message only
                    clientMessage = `Error: ${error.message}`;
            } else {
                    // Generic failure: Prefix with Authentication failed
                    clientMessage = `Authentication failed: ${error.message}`;
            }

            setMessage(clientMessage);
            
        } finally {
            setLoading(false);
        }
    };

    

    const handleGuestContinue = async () => {
         try {
            const res = await fetch("http://localhost:3001/api/auth/guest", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
            });

            const data = await res.json();

            if (!res.ok) {
            console.error("Guest login failed:", data);
            alert(data.error || "Guest login failed");
            return;
            }

            console.log("Guest login success:", data);
            
            if (onGuestLogin) {
                onGuestLogin(data);
            }

            // Save token for later requests
            //localStorage.setItem("token", data.token);
            //localStorage.setItem("user", JSON.stringify(data.user));


            return data;
        } catch (err) {
            console.error("Error calling guest endpoint:", err);
        }
    };

    return (
        <div className="card auth-card">
            {/* --- Welcome Modal (Only shows on Sign Up) --- */}
            <SignUpModal 
                isWelcomeModalOpen={isWelcomeModalOpen} 
                setIsWelcomeModalOpen={setIsWelcomeModalOpen} 
                authView={authView}
            />
            {/* --- GUEST CONFIRMATION MODAL --- */}
            {showGuestModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-body">
                            <h2>Continue as Guest?</h2>
                            
                            <div style={{background: 'rgba(255, 149, 0, 0.1)', borderLeft: '4px solid var(--primary-orange)', padding: '10px', marginBottom: '15px', textAlign: 'left'}}>
                                <p style={{fontSize: '0.9rem', margin: 0}}>
                                    <strong>Note:</strong> Guest mode is recommended for one-time customers only.
                                </p>
                            </div>

                            <p style={{marginBottom: '10px', textAlign: 'left'}}>
                                By continuing as a guest, you will <strong>miss out</strong> on:
                            </p>
                            <ul style={{textAlign: 'left', paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px'}}>
                                <li>Tracking your haircut history</li>
                                <li>Earning loyalty points & rewards</li>
                                <li>Receiving email notifications for your turn</li>
                            </ul>
                        </div>
                        <div className="modal-footer">
                            <button 
                                onClick={() => setShowGuestModal(false)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleGuestContinue}
                                className="btn btn-primary"
                            >
                                I'll use Guest Mode
                            </button>
                        </div>
                        <div style={{padding: '0 20px 20px'}}>
                             <button 
                                onClick={() => { setShowGuestModal(false); setAuthView('signup'); }}
                                className="btn btn-link btn-full-width"
                                style={{fontSize: '0.9rem'}}
                            >
                                Wait, I want to Sign Up instead
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {authView === 'forgotPassword' ? (
                <ForgotPassword 
                    handleForgotPassword={handleForgotPassword}
                    email={email}
                    setEmail={setEmail}
                    loading={loading}
                    setAuthView={setAuthView}
                    setMessage={setMessage}
                />
            ) : (
                <>
                    <div className="card-header">
                        <h2>{authView === 'login' ? 'Login' : 'Sign Up'}</h2>
                        <ThemeToggleButton />
                    </div>
                    <form onSubmit={handleAuth} className="card-body">
                        <div className="form-group"><label>Username:</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" autoComplete="username" /></div>

                        <div className="form-group password-group">
                            <label>Password:</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="6"
                                autoComplete={authView === 'login' ? "current-password" : "new-password"}
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <IconEyeOff /> : <IconEye />}
                            </button>
                        </div>

                        {authView === 'login' && (
                            <>
                                <div className="form-group">
                                    <label>Login As:</label>
                                    <div className="role-toggle">
                                        <button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button>
                                        <button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button>
                                    </div>
                                </div>
                                
                                {selectedRole === 'barber' && (
                                    <div className="form-group pin-input">
                                        <label>Barber PIN:</label>
                                        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required={selectedRole === 'barber'} autoComplete="off" />
                                    </div>
                                )}

                                <div className="forgot-password-link">
                                    <button type="button" onClick={() => { setAuthView('forgotPassword'); setMessage(''); setEmail(''); }}>
                                        Forgot Password?
                                    </button>
                                </div>
                            </>
                        )}

                        {authView === 'signup' && (
                            <>
                                <div className="form-group">
                                    <label>Sign Up As:</label>
                                    <div className="role-toggle">
                                        <button type="button" className={selectedRole === 'customer' ? 'active' : ''} onClick={() => setSelectedRole('customer')}>Customer</button>
                                        <button type="button" className={selectedRole === 'barber' ? 'active' : ''} onClick={() => setSelectedRole('barber')}>Barber</button>
                                    </div>
                                </div>
                                <div className="form-group"><label>Email:</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /><small>Needed for account functions.</small></div>
                                <div className="form-group"><label>Full Name:</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" /></div>
                                {selectedRole === 'barber' && (<div className="form-group"><label>Barber Code:</label><input type="text" value={barberCode} placeholder="Secret code" onChange={(e) => setBarberCode(e.target.value)} required={selectedRole === 'barber'} /><small>Required.</small></div>)}
                            </>
                        )}
                        
                        <button type="submit" disabled={loading} className="btn btn-primary btn-full-width">
                            {loading ? 'Please wait...' : (authView === 'login' ? 'Login' : 'Sign Up')}
                        </button>
                        {/* --- GUEST MODE SECTION (Only in Login View & Customer Role) --- */}
                        {authView === 'login' && selectedRole === 'customer' && (
                            <div style={{marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-color)', textAlign: 'center'}}>
                                <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px'}}>Just visiting for today?</p>
                                <button 
                                    type="button"
                                    onClick={() => setShowGuestModal(true)}
                                    className="btn btn-link"
                                    style={{fontSize: '0.9rem', fontWeight: '600'}}
                                >
                                    Continue as Guest
                                </button>
                            </div>
                        )}
                    </form>
                    <div className="card-footer">
                        {/* FIX: improved message coloring logic */}
                        {message && (
                            <p className={`message ${/failed|error|taken|registered|required|invalid/i.test(message) ? 'error' : 'success'}`}>
                                {message}
                            </p>
                        )}
                        
                        <button type="button" onClick={() => { setAuthView(authView === 'login' ? 'signup' : 'login'); setMessage(''); setSelectedRole('customer'); setPin(''); setBarberCode(''); }} className="btn btn-link">
                            {authView === 'login' ? 'Need account? Sign Up' : 'Have account? Login'}
                        </button>
                    </div>
                </>
            )}
    
        </div>
    )
}
