import axios from "axios";
import { useEffect, useState } from "react";
import { API_URL } from "../http-commons";
import { IconRefresh } from "../assets/Icon";

export const BookingsView = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/appointments`);
            setBookings(res.data);
        } catch (error) {
            console.error("Failed to load bookings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBookings(); }, []);

    // Helper function to format time in Philippines timezone
    const formatPhilippinesTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-PH', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Manila'
        });
    };

    // Helper function to format date in Philippines timezone
    const formatPhilippinesDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-PH', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: 'Asia/Manila'
        });
    };

    const handleAdminReject = async (apptId, customerName) => {
        const reason = prompt(`Reason for rejecting ${customerName}'s appointment?`);
        if (!reason) return; // Cancelled by admin

        try {
            // We reuse the existing reject endpoint
            await axios.put(`${API_URL}/appointments/reject`, {
                appointmentId: apptId,
                reason: `(Admin Action) ${reason}` // Tag it so user knows Admin did it
            });
            alert("Appointment cancelled and user notified.");
            fetchBookings(); // Refresh list
        } catch (error) {
            alert("Failed to reject appointment.");
        }
    };
    
    return (
        <div className="card">
            <div className="card-header">
                <h2>📅 Shop Bookings</h2>
                <button onClick={fetchBookings} className="btn btn-icon"><IconRefresh /></button>
            </div>
            <div className="card-body">
                {loading ? <p className="empty-text">Loading bookings...</p> : bookings.length === 0 ? (
                    <p className="empty-text">No upcoming appointments found.</p>
                ) : (
                    <ul className="queue-list">
                        {bookings.map((appt) => {
                            // Use Philippines timezone for "isToday" check
                            const dateObj = new Date(appt.scheduled_time);
                            const todayPH = new Date(new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }));
                            const isToday = dateObj.toDateString() === todayPH.toDateString();

                            return (
                                <li key={appt.id} style={{
                                    display: 'flex', 
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '15px',
                                    marginBottom: '10px',
                                    borderLeft: appt.status === 'pending' ? '4px solid #FFD700' : (isToday ? '4px solid var(--primary-orange)' : '4px solid var(--border-color)'),
                                    background: 'var(--bg-dark)',
                                    borderRadius: '6px'
                                }}>
                                    {/* Left Side: Info */}
                                    <div>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px'}}>
                                            {appt.status === 'pending' && (
                                                <span style={{background:'#FFD700', color:'black', padding:'2px 6px', borderRadius:'4px', fontSize:'0.7rem', fontWeight:'bold'}}>
                                                    PENDING
                                                </span>
                                            )}
                                            <strong style={{fontSize:'1.1rem', color: isToday ? 'var(--primary-orange)' : 'var(--text-primary)'}}>
                                                {formatPhilippinesDate(appt.scheduled_time)}
                                            </strong>
                                            <span style={{fontWeight:'bold', fontSize:'1.1rem'}}>
                                                {formatPhilippinesTime(appt.scheduled_time)}
                                            </span>
                                        </div>
                                        <div style={{fontSize:'0.95rem'}}>
                                            <strong>{appt.customer_name}</strong> 
                                            <span style={{color:'var(--text-secondary)'}}> with </span>
                                            <strong>{appt.barber_profiles?.full_name}</strong>
                                        </div>
                                        <div style={{fontSize:'0.85rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                                            Service: {appt.services?.name}
                                            {appt.is_converted_to_queue && <span style={{color:'var(--success-color)', marginLeft:'8px', fontWeight:'bold'}}>(Live in Queue)</span>}
                                        </div>
                                    </div>

                                    {/* Right Side: Actions */}
                                    {!appt.is_converted_to_queue && (
                                        <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                            {/* 🟢 NEW: ACCEPT BUTTON (Only for Pending) */}
                                            {appt.status === 'pending' && (
                                                <button 
                                                    onClick={async () => {
                                                        if(!window.confirm(`Confirm appointment for ${appt.customer_name}?`)) return;
                                                        try {
                                                            await axios.put(`${API_URL}/appointments/approve`, { appointmentId: appt.id });
                                                            alert("Appointment Confirmed!");
                                                            fetchBookings(); // Refresh list
                                                        } catch(e) { alert("Failed to approve."); }
                                                    }}
                                                    className="btn btn-success"
                                                    style={{padding:'6px 12px', fontSize:'0.8rem'}}
                                                >
                                                    ✅ Accept
                                                </button>
                                            )}

                                            {/* 🔴 REJECT BUTTON (Always available) */}
                                            <button 
                                                onClick={() => handleAdminReject(appt.id, appt.customer_name)}
                                                className="btn btn-danger"
                                                style={{padding:'6px 12px', fontSize:'0.8rem'}}
                                            >
                                                ❌ Reject
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
