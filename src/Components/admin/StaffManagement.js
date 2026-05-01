import { useState, useEffect } from "react";
import apiClient from "../http-commons";
import { supabase } from "../supabase";

export const StaffManagement = () => {
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");

    // Fetch barbers from Supabase
    const fetchStaffList = async () => {
        setIsLoading(true);
        try {
            // Assuming your staff have a role of 'barber' in the profiles table
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'barber')
                .order('full_name', { ascending: true });

            if (error) throw error;
            setStaffList(data || []);
        } catch (error) {
            console.error("Error fetching staff:", error);
            setMessage("Failed to load staff members.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffList();
    }, []);

    // Toggle logic for Activate/Deactivate
    const handleToggleStatus = async (barberId, currentActiveStatus) => {
        const newStatus = !currentActiveStatus;
        const actionText = newStatus ? "Activate" : "Deactivate";

        if (!window.confirm(`Are you sure you want to ${actionText} this staff member?`)) return;

        try {
            // This calls the backend route we created earlier
            await apiClient.put(`/admin/staff/toggle/${barberId}`, { status: newStatus });
            
            setMessage(`Staff member successfully ${actionText}d!`);
            fetchStaffList(); // Refresh the list to show updated status
        } catch (err) {
            console.error("Failed to toggle status:", err);
            setMessage("Error: Could not update staff status.");
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2>👥 Staff Management</h2>
                <p style={{ color: 'var(--text-secondary)', margin: '0' }}>
                    Activate or deactivate barbers. Deactivated barbers can log in but will be hidden from the customer queue.
                </p>
            </div>

            <div className="card-body">
                {message && (
                    <div className={`message ${message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}`} style={{ marginBottom: '15px', padding: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.1)' }}>
                        {message}
                    </div>
                )}

                {isLoading ? (
                    <div className="loading">Loading staff...</div>
                ) : staffList.length === 0 ? (
                    <div className="empty-state">
                        <p>No staff members found.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Email</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>System Status</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffList.map((staff) => (
                                <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '10px' }}>
                                        <strong>{staff.full_name || 'Unnamed Barber'}</strong>
                                    </td>
                                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                                        {staff.email}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.85rem',
                                            background: staff.is_active ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                                            color: staff.is_active ? 'var(--success-color)' : 'var(--error-color)'
                                        }}>
                                            {staff.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                                            className={`btn ${staff.is_active ? 'btn-danger' : 'btn-success'}`}
                                            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                        >
                                            {staff.is_active ? '⛔ Deactivate' : '✅ Activate'}
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