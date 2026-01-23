import { useState } from "react";
import { API_URL } from "./http-commons";
import { supabase } from "./supabase";
import { IconEye, IconEyeOff } from "./assets/Icon";
import axios from "axios";

export const AdminLoginForm = ({ onCancel, onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post(`${API_URL}/login/username`, {
                username: username.trim(),
                password,
                role: 'admin' // <--- Force 'admin' role
            });

            if (response.data.user?.email && supabase) {
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email: response.data.user.email,
                    password
                });
                if (authError) throw authError;
                
                // Success! The main App component listener will detect the session change
                if (onLoginSuccess) onLoginSuccess();
            }
        } catch (err) {
            console.error("Admin login failed:", err);
            setError(err.response?.data?.error || "Login failed. Check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-container" style={{backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(124, 77, 255, 0.15), transparent 60%)'}}>
            <nav className="auth-nav">
                <button onClick={onCancel} className="btn btn-link btn-back-home" style={{color: '#ff3b30'}}>
                    ← Exit Admin Portal
                </button>
            </nav>
            
            <div className="auth-content">
                <div className="card auth-card" style={{borderColor: '#ff3b30'}}>
                    <div className="card-header" style={{borderBottom: '2px solid #ff3b30'}}>
                        <h2 style={{color: '#ff3b30'}}>Admin Access</h2>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal'}}>
                            Authorized Personnel Only
                        </div>
                    </div>
                    
                    <form onSubmit={handleLogin} className="card-body">
                        <div className="form-group">
                            <label>Admin Username:</label>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                required 
                                autoFocus
                            />
                        </div>
                        
                        <div className="form-group password-group">
                            <label>Password:</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <IconEyeOff /> : <IconEye />}
                            </button>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="btn btn-full-width"
                            style={{backgroundColor: '#ff3b30', color: 'white', marginTop: '10px'}}
                        >
                            {loading ? 'Authenticating...' : 'Authenticate'}
                        </button>
                    </form>

                    <div className="card-footer" style={{borderTop: '1px solid var(--border-color)'}}>
                        {error && <p className="message error">{error}</p>}
                        <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '10px'}}>
                            System activity is logged.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
