import { useState } from "react";
import { supabase } from "../supabase";
import { ThemeToggleButton } from "../Partials/ThemeToggleButton";

export const UpdatePasswordForm = ({ onPasswordUpdated }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        if (password.length < 6) {
            setMessage('Password must be at least 6 characters.');
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;

            setMessage('Password updated successfully! You can now log in.');
            setTimeout(() => {
                onPasswordUpdated();
            }, 2000);

        } catch (error) {
            console.error('Error updating password:', error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card auth-card">
            <div className="card-header">
                <h2>Set Your New Password</h2>
                <ThemeToggleButton />
            </div>
            <form onSubmit={handlePasswordReset} className="card-body">
                <p>You have been verified. Please enter a new password.</p>
                <div className="form-group password-group">
                    <label>New Password:</label>
                    <input
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength="6"
                    />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary btn-full-width">
                    {loading ? 'Updating...' : 'Set New Password'}
                </button>
            </form>
            <div className="card-footer">
                {message && (
                    <p className={`message ${/error|failed|must be/i.test(message) ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}
