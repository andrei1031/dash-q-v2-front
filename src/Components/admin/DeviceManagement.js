import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../http-commons";

export const DeviceManagement = ({ session }) => {
    const [blockedDevices, setBlockedDevices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockReason, setBlockReason] = useState("");
    const [blockingDevice, setBlockingDevice] = useState(null);
    const [message, setMessage] = useState("");

    useEffect(() => {
        fetchBlockedDevices();
    }, []);

    const fetchBlockedDevices = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/admin/blocked-devices`);
            setBlockedDevices(response.data || []);
        } catch (error) {
            console.error("Error fetching blocked devices:", error);
            setMessage("Failed to load blocked devices.");
        } finally {
            setIsLoading(false);
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
            fetchBlockedDevices();
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
            fetchBlockedDevices();
        } catch (error) {
            console.error("Error unblocking device:", error);
            setMessage(error.response?.data?.error || "Failed to unblock device.");
        }
    };

    const getDeviceInfo = (device) => {
        // Extract readable info from fingerprint
        const fp = device.device_fingerprint || "";
        // Show truncated fingerprint for display
        return fp.length > 20 ? fp.substring(0, 20) + "..." : fp;
    };

    return (
        <div className="device-management">
            <div className="section-header">
                <h2>Device Management</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    Manage blocked devices. Blocked devices cannot access the queue system as guests.
                </p>
            </div>

            {message && (
                <div className={`message ${message.includes('Failed') || message.includes('failed') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            {isLoading ? (
                <div className="loading">Loading blocked devices...</div>
            ) : blockedDevices.length === 0 ? (
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
                                                Unblock
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

            {/* Block Device Modal */}
            {showBlockModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Block Device</h3>
                        </div>
                        <form onSubmit={handleBlockDevice}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Device Fingerprint:</label>
                                    <input 
                                        type="text" 
                                        value={blockingDevice?.device_fingerprint || ''} 
                                        readOnly 
                                        className="form-control"
                                        style={{ background: 'var(--bg-dark)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Reason for Blocking:</label>
                                    <textarea
                                        value={blockReason}
                                        onChange={(e) => setBlockReason(e.target.value)}
                                        placeholder="Enter reason (e.g., 'Trolling behavior', 'Spam')"
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

