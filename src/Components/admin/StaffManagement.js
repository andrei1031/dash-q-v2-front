import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "src/Components/http-commons"; // Ensure this import path is correct
import { supabase } from "src/Components/supabase";

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
            await axios.post(`${API_URL}/admin/toggle-barber/${barberId}`, { 
                adminUserId: session.user.id,
                status: newStatus 
            });
            fetchStaffList();
            setMessage(`Barber status updated.`);
        } catch (err) {
            setMessage("Failed to update status.");
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
            await axios.post(`${API_URL}/admin/delete-barber/${id}`, { adminUserId: session.user.id });
            fetchStaffList();
        } catch (error) {
            setMessage("Failed to delete barber.");
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2>💈 Staff Management</h2>
            </div>
            
            <div className="card-body">
                {message && <div className="message">{message}</div>}

                <form onSubmit={handleAddOrEditBarber} style={{ marginBottom: '20px' }}>
                    <input 
                        value={barberName} 
                        onChange={(e) => setBarberName(e.target.value)} 
                        placeholder="Enter Barber Name" 
                        required 
                    />
                    <button type="submit">{editingBarber ? "Update" : "Add"}</button>
                    {editingBarber && <button onClick={() => {setEditingBarber(null); setBarberName("");}}>Cancel</button>}
                </form>

                {isLoading ? <div>Loading...</div> : (
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Active</th>
                                <th>Bookable</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffList.map((barber) => (
                                <tr key={barber.id}>
                                    <td>{barber.full_name}</td>
                                    <td>
                                        <button onClick={() => handleToggleStatus(barber.id, barber.is_active)}>
                                            {barber.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td>
                                        <input 
                                            type="checkbox" 
                                            checked={barber.is_booking_enabled} 
                                            onChange={() => handleToggleBooking(barber.id, barber.is_booking_enabled)}
                                        />
                                    </td>
                                    <td>
                                        <button onClick={() => { setEditingBarber(barber); setBarberName(barber.full_name); }}>Edit</button>
                                        <button onClick={() => deleteBarber(barber.id)}>Delete</button>
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