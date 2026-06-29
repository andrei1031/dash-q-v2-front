import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../http-commons";
import { supabase } from "../supabase";

export const StaffManagement = ({ session }) => {
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [barberName, setBarberName] = useState("");
    const [editingBarber, setEditingBarber] = useState(null);

    useEffect(() => {
        fetchStaffList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchStaffList = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('barber_profiles')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            setStaffList(data || []);
        } catch (error) {
            console.error("Error fetching staff:", error);
            setMessage("Failed to load staff members.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddOrEditBarber = async (e) => {
        e.preventDefault();
        
        if (!session?.user?.id) {
            setMessage("Error: No admin session found.");
            return;
        }

        try {
            const payload = { 
                adminUserId: session.user.id, 
                full_name: barberName 
            };

            if (editingBarber) {
                await axios.post(`${API_URL}/admin/update-barber/${editingBarber.id}`, payload);
                setMessage("Barber updated successfully!");
            } else {
                await axios.post(`${API_URL}/admin/add-barber`, payload);
                setMessage("Barber added successfully!");
            }
            
            setBarberName("");
            setEditingBarber(null);
            fetchStaffList();
            setTimeout(() => setMessage(""), 3000);
        } catch (error) {
            setMessage("Failed to save barber: " + (error.response?.data?.error || error.message));
        }
    };

    // 🟢 UPDATED TO USE PUT ROUTE
    const handleToggleStatus = async (barberId, currentActiveStatus) => {
        const newStatus = !currentActiveStatus;
        try {
            await axios.put(`${API_URL}/admin/barbers/${barberId}/status`, { 
                userId: session.user.id,
                is_active: newStatus 
            });
            fetchStaffList();
            setMessage(`Barber status updated.`);
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            setMessage("Failed to update status: " + (err.response?.data?.error || err.message));
        }
    };

    const handleToggleBooking = async (barberId, currentStatus) => {
        const newState = !currentStatus;
        try {
            // Changed from .post to .put
            await axios.put(`${API_URL}/admin/barber/booking-status`, { 
                userId: session.user.id,
                barberId: barberId, 
                is_booking_enabled: newState 
            });
            fetchStaffList();
            setMessage(`Booking status updated.`);
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            console.error("Booking toggle error:", err);
            setMessage("Failed to update booking status: " + (err.response?.data?.error || err.message));
        }
    };

    // 🟢 UPDATED TO USE DELETE ROUTE
    const deleteBarber = async (id) => {
        if (!window.confirm("Permanently delete this barber?")) return;
        try {
            await axios.delete(`${API_URL}/admin/barbers/${id}`, { 
                data: { userId: session.user.id } 
            });
            fetchStaffList();
            setMessage("Barber deleted successfully.");
            setTimeout(() => setMessage(""), 3000);
        } catch (error) {
            setMessage("Failed to delete barber: " + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2>💈 Staff Management</h2>
                <p style={{ color: 'var(--text-secondary)', margin: '0', fontSize: '0.9rem' }}>
                    Manage barber availability. Inactive barbers are hidden from the live queue.
                </p>
            </div>
            
            <div className="card-body">
                {message && (
                    <div style={{ 
                        marginBottom: '15px', 
                        padding: '10px 15px', 
                        borderRadius: '6px', 
                        background: message.includes('Failed') || message.includes('Error') ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)',
                        color: message.includes('Failed') || message.includes('Error') ? 'var(--error-color)' : 'var(--success-color)',
                        border: `1px solid ${message.includes('Failed') || message.includes('Error') ? 'var(--error-color)' : 'var(--success-color)'}`
                    }}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleAddOrEditBarber} style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input 
                        value={barberName} 
                        onChange={(e) => setBarberName(e.target.value)} 
                        placeholder="Enter Barber Name..." 
                        required 
                        style={{ 
                            flex: '1', 
                            minWidth: '200px',
                            padding: '10px 15px', 
                            borderRadius: '6px', 
                            border: '1px solid var(--border-color)', 
                            background: 'var(--bg-dark)', 
                            color: 'var(--text-primary)',
                            fontSize: '1rem'
                        }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
                        {editingBarber ? "✅ Update Barber" : "➕ Add Barber"}
                    </button>
                    {editingBarber && (
                        <button type="button" onClick={() => {setEditingBarber(null); setBarberName("");}} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
                            Cancel
                        </button>
                    )}
                </form>

                {isLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading staff data...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '12px 15px' }}>Name</th>
                                    <th style={{ padding: '12px 15px', textAlign: 'center' }}>Status</th>
                                    <th style={{ padding: '12px 15px', textAlign: 'center' }}>Bookable</th>
                                    <th style={{ padding: '12px 15px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffList.length > 0 ? staffList.map((barber) => (
                                    <tr key={barber.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '15px', fontWeight: '600', fontSize: '1.05rem' }}>
                                            {barber.full_name}
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold',
                                                background: barber.is_active ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)',
                                                color: barber.is_active ? 'var(--success-color)' : 'var(--error-color)'
                                            }}>
                                                {barber.is_active ? '● Active' : '○ Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={barber.is_booking_enabled ?? false} 
                                                    onChange={() => handleToggleBooking(barber.id, barber.is_booking_enabled)}
                                                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-orange)' }}
                                                />
                                            </label>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                                <button 
                                                    onClick={() => handleToggleStatus(barber.id, barber.is_active)}
                                                    className={`btn ${barber.is_active ? 'btn-secondary' : 'btn-success'}`}
                                                    style={{ fontSize: '0.85rem', padding: '6px 12px', minWidth: '90px' }}
                                                >
                                                    {barber.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button 
                                                    onClick={() => { setEditingBarber(barber); setBarberName(barber.full_name); }}
                                                    className="btn btn-primary"
                                                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => deleteBarber(barber.id)}
                                                    className="btn btn-danger"
                                                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No barbers found. Add your first staff member above.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};