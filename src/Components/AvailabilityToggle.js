import { useState } from "react";
import { API_URL } from "./http-commons";
import axios from "axios";

export const AvailabilityToggle = ({ barberProfile, session, onAvailabilityChange }) => {
    const isAvailable = barberProfile?.is_available || false;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleToggle = async () => {
        if (!barberProfile || !session?.user) return;
        setLoading(true); setError('');
        const newAvailability = !isAvailable;
        try {
            const response = await axios.put(`${API_URL}/barber/availability`, {
                barberId: barberProfile.id, isAvailable: newAvailability, userId: session.user.id
            });
            onAvailabilityChange(response.data.is_available);
        } catch (err) { console.error("Failed toggle availability:", err); setError(err.response?.data?.error || "Could not update."); }
        finally { setLoading(false); }
    };

    return (
        <div className="availability-toggle">
            <p>Status: 
                <span className={`status-dot ${isAvailable ? 'online' : 'offline'}`}></span>
                <strong>{isAvailable ? 'Available' : 'Offline'}</strong>
            </p>
            <button 
                onClick={handleToggle} 
                disabled={loading} 
                className={`btn ${isAvailable ? 'btn-danger' : 'btn-success'}`}
            >
                {isAvailable ? 'Go Offline' : 'Go Online'}
            </button>
            {error && <p className="error-message small">{error}</p>}
        </div>
    )
}
