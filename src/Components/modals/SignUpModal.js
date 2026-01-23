
export const SignUpModal = ({isWelcomeModalOpen, setIsWelcomeModalOpen, authView}) => {
    return (
        <div
            className="modal-overlay"
            style={{ display: (isWelcomeModalOpen && authView === 'signup') ? 'flex' : 'none' }}
        >
            <div className="modal-content">
                <div className="modal-body">
                    <h2>Welcome to Dash-Q!</h2>
                    <p>This application was proudly developed by:<br />
                        <strong>Aquino, Zaldy Castro Jr.</strong><br />
                        <strong>Galima, Denmark Perpose</strong><br />
                        <strong>Saldivar, Reuben Andrei Santos</strong>
                        <br /><br />from<br /><br />
                        <strong>University of the Cordilleras</strong>
                    </p>
                </div>
                <div className="modal-footer">
                    <button 
                        id="close-welcome-modal-btn" 
                        onClick={() => setIsWelcomeModalOpen(false)}
                        className="btn btn-primary"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        </div>
    )
}
