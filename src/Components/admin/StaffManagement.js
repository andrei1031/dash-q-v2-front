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
        
        // Safety check to prevent "Cannot read properties of undefined"
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
        } catch (error) {
            setMessage("Failed to save barber: " + (error.response?.data?.error || error.message));
        }
    };

    const handleToggleStatus = async (barberId, currentActiveStatus) => {
        const newStatus = !currentActiveStatus;
        try {
            // Updated to match your backend route
            await axios.put(`${API_URL}/admin/barbers/${barberId}/status`, { 
                userId: session.user.id, 
                is_active: newStatus 
            });
            fetchStaffList();
            setMessage(`Barber status updated.`);
        } catch (err) {
            console.error("Toggle error:", err);
            setMessage("Failed to update status: " + (err.response?.data?.error || err.message));
        }
    };

    const handleToggleBooking = async (barberId, currentStatus) => {
        const newState = !currentStatus;
        try {
            await axios.post(`${API_URL}/admin/barber/booking-status`, { 
                barberId, 
                is_booking_enabled: newState 
            });
            fetchStaffList();
        } catch (err) {
            setMessage("Failed to update booking status.");
        }
    };

    const deleteBarber = async (id) => {
        if (!window.confirm("Permanently delete this barber?")) return;
        try {
            await axios.delete(`${API_URL}/admin/barbers/${id}`, { 
                data: { userId: session.user.id } 
            });
            fetchStaffList();
            setMessage("Barber deleted successfully.");
        } catch (error) {
            console.error("Delete error:", error);
            setMessage("Failed to delete barber: " + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className="staff-management-container">
            <h2>Staff Management</h2>
            
            {message && <div className="alert">{message}</div>}

            {/* Input Form */}
            <form onSubmit={handleAddOrEditBarber} className="staff-form">
                <input 
                    value={barberName} 
                    onChange={(e) => setBarberName(e.target.value)} 
                    placeholder="Barber Name" 
                    required 
                />
                <button type="submit">{editingBarber ? "Update" : "Add"}</button>
            </form>

            {/* Simple Table Layout */}
            {isLoading ? <div>Loading...</div> : (
                <table className="staff-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffList.map((barber) => (
                            <tr key={barber.id}>
                                <td>{barber.full_name}</td>
                                <td>{barber.is_active ? 'Active' : 'Inactive'}</td>
                                <td>
                                    <button onClick={() => handleToggleStatus(barber.id, barber.is_active)}>
                                        {barber.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button onClick={() => { setEditingBarber(barber); setBarberName(barber.full_name); }}>Edit</button>
                                    <button onClick={() => deleteBarber(barber.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};