import { ThemeToggleButton } from "../Partials/ThemeToggleButton";

export const ForgotPassword = ({ handleForgotPassword, email, setEmail, loading, setAuthView, setMessage }) => {
    return (
        <>
            <div className="card-header">
                <h2>Reset Password</h2>
                <ThemeToggleButton />
            </div>
            <form onSubmit={handleForgotPassword} className="card-body">
                <p>Enter your email. We will send you a link to reset your password.</p>
                <div className="form-group">
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary btn-full-width">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
            <div className="card-footer">
                <button type="button" onClick={() => { setAuthView('login'); setMessage(''); }} className="btn btn-link">
                    Back to Login
                </button>
            </div>
        </>
    )
}
