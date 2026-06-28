import { useState, useEffect } from "react";
import apiClient from "../http-commons";
import { supabase } from "../supabase";

export const StaffManagement = () => {
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");

    const fetchStaffList = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('barber_profiles')
                .select('*')
                .order('id', { ascending: true }); // Keeps the list stable when updating

            if (error) throw error;
            setStaffList(data || []);
        } catch (error) {
            console.error("Error fetching staff from barber_profile:", error);
            setMessage("Failed to load staff members.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffList();
    }, []);

    const handleToggleStatus = async (barberId, currentActiveStatus) => {
        const newStatus = !currentActiveStatus;
        const actionText = newStatus ? "Activate" : "Deactivate";

        if (!window.confirm(`Are you sure you want to ${actionText} this barber?`)) return;

        try {
            // 1. Send the update to the backend
            await apiClient.put(`/admin/staff/toggle/${barberId}`, { status: newStatus });
            
            // 2. INSTANTLY update the UI locally without waiting for the database
            setStaffList(prevList => 
                prevList.map(barber => 
                    barber.id === barberId 
                        ? { ...barber, is_active: newStatus, is_available: newStatus } 
                        : barber
                )
            );

            // 3. Show the success banner
            setMessage(`Barber successfully ${actionText}d!`);
            setTimeout(() => setMessage(''), 3000); // Clears message automatically
        } catch (err) {
            const serverError = err.response?.data?.error || err.message || "Unknown error";
            console.error("Toggle Failed Details:", err.response?.data || err);
            setMessage(`Error: ${serverError}`);
        }
    };

    // 🟢 MOVED THIS ABOVE THE RETURN STATEMENT 🟢
    const handleToggleBooking = async (barberId, currentStatus) => {
        const newState = !currentStatus;
        try {
            await apiClient.put(`/admin/barber/booking-status`, {
                barberId: barberId,
                is_booking_enabled: newState
            });
            
            // Update UI locally
            setStaffList(prevList => 
                prevList.map(barber => 
                    barber.id === barberId ? { ...barber, is_booking_enabled: newState } : barber
                )
            );
            setMessage(`Booking is now ${newState ? 'ENABLED' : 'DISABLED'} for this barber.`);
            setTimeout(() => setMessage(''), 3000); // Clears message automatically
        } catch (err) {
            console.error("Failed to toggle booking status", err);
            setMessage("Failed to update appointment status.");
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2>💈 Barber Management</h2>
                <p style={{ color: 'var(--text-secondary)', margin: '0' }}>
                    Manage barber availability. Inactive barbers are hidden from the queue.
                </p>
            </div>

            <div className="card-body">
                {message && (
                    <div className={`message ${message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}`} style={{ marginBottom: '15px', padding: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.1)' }}>
                        {message}
                    </div>
                )}

                {isLoading ? (
                    <div className="loading">Loading barbers...</div>
                ) : staffList.length === 0 ? (
                    <div className="empty-state">
                        <p>No barbers found in barber_profile.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Queue Status</th>
                                {/* 🟢 Added missing header for Bookings 🟢 */}
                                <th style={{ padding: '10px', textAlign: 'center' }}>Appointments</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffList.map((barber) => (
                                <tr key={barber.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '10px' }}>
                                        <strong>{barber.full_name || 'Unnamed Barber'}</strong>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', color: barber.is_active ? 'var(--success-color)' : 'var(--error-color)' }}>
                                            {barber.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <label style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={barber.is_booking_enabled ?? true} 
                                                onChange={() => handleToggleBooking(barber.id, barber.is_booking_enabled ?? true)}
                                            />
                                            &nbsp;Bookable
                                        </label>
                                    </td>

                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleToggleStatus(barber.id, barber.is_active)}
                                            className={`btn ${barber.is_active ? 'btn-danger' : 'btn-success'}`}
                                            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                        >
                                            {barber.is_active ? '⛔ Deactivate' : '✅ Activate'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};