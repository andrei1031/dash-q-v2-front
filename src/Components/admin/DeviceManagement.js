import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../http-commons";
import { supabase } from "../supabase";

export const DeviceManagement = ({ session }) => {
    const [blockedDevices, setBlockedDevices] = useState([]);
    const [recentGuests, setRecentGuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockReason, setBlockReason] = useState("");
    const [blockingDevice, setBlockingDevice] = useState(null);
    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState('recent'); // 'recent' or 'blocked'
    const [appeals, setAppeals] = useState([]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    

    const fetchAppeals = async () => {
        try {
            const { data, error } = await supabase
                .from('appeals')
                .select('*')
                .eq('status', 'pending');
            if (!error) setAppeals(data || []);
        } catch (err) {
            console.error("Error loading appeals:", err);
        }
    };

    const resolveAppeal = async (appealId, fingerprint) => {
        if (!window.confirm("Approve this appeal? This will unblock the device.")) return;
        try {
            // 1. Unblock the device
            await axios.post(`${API_URL}/admin/unblock-device`, { deviceFingerprint: fingerprint });
            // 2. Mark appeal as resolved
            await supabase.from('appeals').update({ status: 'resolved' }).eq('id', appealId);
            setMessage("Appeal approved and device unblocked!");
            fetchAppeals();
            fetchData(); // Refresh everything
        } catch (err) {
            setMessage("Failed to resolve appeal.");
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const blockedRes = await axios.get(`${API_URL}/admin/blocked-devices`);
            setBlockedDevices(blockedRes.data || []);
            await fetchRecentGuests();
        } catch (error) {
            console.error("Error fetching data:", error);
            setMessage("Failed to load data.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRecentGuests = async () => {
        try {
            // Fetch recent queue entries that have device fingerprint (these are guest or device-tracked users)
            const { data, error } = await supabase
                .from('queue_entries')
                .select('id, customer_name, device_fingerprint, barber_id, status, created_at, user_id')
                .not('device_fingerprint', 'is', null)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (!error && data) {
                setRecentGuests(data);
            }
        } catch (err) {
            console.error("Error fetching recent guests:", err);
        }
    };

    const handleBlockDevice = async (e) => {
        e.preventDefault();
        
        if (!blockReason.trim()) {
            setMessage("Please provide a reason for blocking.");
            return;
        }

        try {
            await axios.post(`${API_URL}/admin/block-device`, {
                adminUserId: session.user.id,
                deviceFingerprint: blockingDevice.deviceFingerprint,
                reason: blockReason
            });
            
            setMessage("Device blocked successfully!");
            setShowBlockModal(false);
            setBlockReason("");
            setBlockingDevice(null);
            fetchData();
        } catch (error) {
            console.error("Error blocking device:", error);
            setMessage(error.response?.data?.error || "Failed to block device.");
        }
    };

    const handleUnblockDevice = async (deviceFingerprint) => {
        if (!window.confirm("Are you sure you want to unblock this device?")) return;

        try {
            await axios.post(`${API_URL}/admin/unblock-device`, {
                adminUserId: session.user.id,
                deviceFingerprint: deviceFingerprint
            });
            
            setMessage("Device unblocked successfully!");
            fetchData();
        } catch (error) {
            console.error("Error unblocking device:", error);
            setMessage(error.response?.data?.error || "Failed to unblock device.");
        }
    };

    const openBlockModal = (device) => {
        setBlockingDevice(device);
        setShowBlockModal(true);
        setBlockReason("");
    };

    const getDeviceInfo = (device) => {
        const fp = device.device_fingerprint || "";
        return fp.length > 20 ? fp.substring(0, 20) + "..." : fp;
    };

    return (
        <div className="device-management">
            <div className="section-header">
                <h2>📱 Device Management</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    Block troll guests from accessing the queue system. Blocked devices cannot join as guests.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="admin-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    className={`btn ${activeTab === 'recent' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('recent')}
                >
                    👥 Recent Guests
                </button>
                <button 
                    className={`btn ${activeTab === 'blocked' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('blocked')}
                >
                    🚫 Blocked Devices ({blockedDevices.length})
                </button>
                <button className={`btn ${activeTab === 'appeals' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setActiveTab('appeals'); fetchAppeals(); }}>📩 Appeals</button>
            </div>

            {message && (
                <div className={`message ${message.includes('Failed') || message.includes('failed') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            {isLoading ? (
                <div className="loading">Loading...</div>
            ) : activeTab === 'recent' ? (
                // Recent Guests Tab
                <div className="recent-guests">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                        View recent guest queue entries. Click "Block" to prevent this device from joining the queue.
                    </p>
                    {recentGuests.length === 0 ? (
                        <div className="empty-state">
                            <p>No guest queue entries found.</p>
                        </div>
                    ) : (
                        <div className="device-list">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Barber</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Device ID</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentGuests.map((guest) => {
                                        const isBlocked = blockedDevices.some(
                                            d => d.device_fingerprint === guest.device_fingerprint && d.is_active
                                        );
                                        return (
                                            <tr key={guest.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '10px' }}>
                                                    <strong>{guest.customer_name}</strong>
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    Barber #{guest.barber_id}
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem',
                                                        background: guest.status === 'In Progress' ? 'rgba(52, 199, 89, 0.1)' : 
                                                                    guest.status === 'Waiting' ? 'rgba(255, 149, 0, 0.1)' : 'rgba(128, 128, 128, 0.1)',
                                                        color: guest.status === 'In Progress' ? 'var(--success-color)' : 
                                                               guest.status === 'Waiting' ? 'var(--primary-orange)' : 'var(--text-secondary)'
                                                    }}>
                                                        {guest.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    {new Date(guest.created_at).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    <code style={{ fontSize: '0.75rem', background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {getDeviceInfo(guest)}
                                                    </code>
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right' }}>
                                                    {isBlocked ? (
                                                        <span style={{ color: 'var(--error-color)', fontSize: '0.85rem' }}>
                                                            ⚠️ Already Blocked
                                                        </span>
                                                    ) : guest.device_fingerprint ? (
                                                        <button 
                                                            onClick={() => openBlockModal({
                                                                deviceFingerprint: guest.device_fingerprint,
                                                                customerName: guest.customer_name
                                                            })}
                                                            className="btn btn-danger"
                                                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                                                        >
                                                            🚫 Block
                                                        </button>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                            No fingerprint
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : activeTab === 'appeals' ? (
                // 🟢 NEW APPEALS TAB RENDER 🟢
                <div className="recent-guests">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                        Review submitted guest account appeals. Approving an appeal automatically unblocks their device.
                    </p>
                    {appeals.length === 0 ? (
                        <div className="empty-state">
                            <p>No pending appeals found.</p>
                        </div>
                    ) : (
                        <div className="device-list">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Contact Email</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Reason for Appeal</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Device ID</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appeals.map((appeal) => (
                                        <tr key={appeal.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '10px' }}>
                                                <strong>{appeal.contact_email}</strong>
                                            </td>
                                            <td style={{ padding: '10px', maxWidth: '300px', wordBreak: 'break-word' }}>
                                                "{appeal.reason}"
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <code style={{ fontSize: '0.75rem', background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {appeal.device_fingerprint ? (appeal.device_fingerprint.substring(0, 15) + "...") : "Unknown"}
                                                </code>
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                <button 
                                                    className="btn btn-success" 
                                                    onClick={() => resolveAppeal(appeal.id, appeal.device_fingerprint)}
                                                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                                >
                                                    Approve & Unblock ✅
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                // Blocked Devices Tab
                <div className="blocked-devices">
                    {blockedDevices.length === 0 ? (
                        <div className="empty-state">
                            <p>No devices are currently blocked.</p>
                        </div>
                    ) : (
                        <div className="device-list">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Device ID</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Reason</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Blocked Date</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {blockedDevices.map((device) => (
                                        <tr key={device.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '10px' }}>
                                                <code style={{ fontSize: '0.85rem', background: 'var(--bg-dark)', padding: '4px 8px', borderRadius: '4px' }}>
                                                    {getDeviceInfo(device)}
                                                </code>
                                            </td>
                                            <td style={{ padding: '10px', maxWidth: '200px' }}>
                                                {device.reason}
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                {device.blocked_at ? new Date(device.blocked_at).toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    background: device.is_active ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)',
                                                    color: device.is_active ? 'var(--error-color)' : 'var(--success-color)'
                                                }}>
                                                    {device.is_active ? 'Blocked' : 'Unblocked'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                {device.is_active ? (
                                                    <button 
                                                        onClick={() => handleUnblockDevice(device.device_fingerprint)}
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                                    >
                                                        ✅ Unblock
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            setBlockingDevice(device);
                                                            setBlockReason(device.reason);
                                                            setShowBlockModal(true);
                                                        }}
                                                        className="btn btn-primary"
                                                        style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                                    >
                                                        Re-block
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Block Device Modal */}
            {showBlockModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>🚫 Block Device</h3>
                        </div>
                        <form onSubmit={handleBlockDevice}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Customer Name:</label>
                                    <input 
                                        type="text" 
                                        value={blockingDevice?.customerName || 'Guest'} 
                                        readOnly 
                                        className="form-control"
                                        style={{ background: 'var(--bg-dark)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Device Fingerprint:</label>
                                    <input 
                                        type="text" 
                                        value={blockingDevice?.deviceFingerprint || ''} 
                                        readOnly 
                                        className="form-control"
                                        style={{ background: 'var(--bg-dark)', fontSize: '0.8rem', wordBreak: 'break-all' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Reason for Blocking:</label>
                                    <textarea
                                        value={blockReason}
                                        onChange={(e) => setBlockReason(e.target.value)}
                                        placeholder="Enter reason (e.g., 'Trolling behavior', 'Spam', 'No-show')"
                                        required
                                        className="form-control"
                                        rows={3}
                                    />
                                    <small style={{ color: 'var(--text-secondary)' }}>
                                        This reason will be shown to the user if they try to access the system.
                                    </small>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowBlockModal(false);
                                        setBlockingDevice(null);
                                        setBlockReason("");
                                    }}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-danger"
                                >
                                    Block Device
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

