import { useEffect, useState } from "react";
// 1. USE YOUR CONFIGURED apiClient TO PREVENT BASE_URL ERRORS
import apiClient from "../http-commons"; 

export const ReportsView = () => {
    const [reports, setReports] = useState([]);
    const [adminNotes, setAdminNotes] = useState({}); 
    
    const fetchReports = async () => {
        try {
            const res = await apiClient.get(`/admin/reports`);
            setReports(res.data);
        } catch (error) {
            console.error("Failed to load reports", error);
        }
    };

    useEffect(() => { fetchReports(); }, []);

    const handleAction = async (reportId, targetId, action) => {
        const note = adminNotes[reportId] || ''; 
        
        if(!window.confirm(`Are you sure you want to ${action.toUpperCase()} this user?`)) return;
        
        try {
            await apiClient.put(`/admin/reports/resolve`, { 
                reportId, 
                targetUserId: targetId, 
                action,
                adminNotes: note 
            });
            
            alert(`Action taken: ${action}`);
            setAdminNotes(prev => {
                const newState = { ...prev };
                delete newState[reportId];
                return newState;
            });
            fetchReports();
        } catch (error) {
            alert("Failed to process report.");
        }
    };

    // --- NEW: UNBAN HANDLER ---
    const handleUnban = async (userId) => {
        if (!window.confirm("Are you sure you want to unban this user?")) return;

        try {
            const response = await apiClient.put(`/reports/unban/${userId}`);
            alert(response.data.message);
            fetchReports(); 
        } catch (err) {
            // IMPROVED: Show the specific error from the backend response
            const serverError = err.response?.data?.error || "Unknown server error";
            const errorDetails = err.response?.data?.details || "";
            
            console.error("Unban failed:", serverError, errorDetails);
            alert(`Error: ${serverError}. ${errorDetails}`);
        }
    };

    const handleNoteChange = (id, text) => {
        setAdminNotes(prev => ({ ...prev, [id]: text }));
    };

    return (
        <div className="card">
            <div className="card-header"><h2>🚨 Incident Reports</h2></div>
            <div className="card-body">
                {reports.length === 0 ? <p className="empty-text">No active reports.</p> : (
                    <ul className="queue-list">
                        {reports.map(r => (
                            <li key={r.id} style={{
                                display:'block', 
                                border: r.status === 'Pending' ? '1px solid var(--error-color)' : '1px solid var(--border-color)',
                                marginBottom: '15px',
                                padding: '15px'
                            }}>
                                <div style={{display:'flex', flexWrap: 'wrap', gap: '10px', justifyContent:'space-between', marginBottom:'10px'}}>
                                    <strong style={{fontSize: '1.1rem'}}>{r.reason}</strong>
                                    <span className={`status-badge`} style={{
                                        background: r.status==='Pending'?'var(--error-color)':'var(--success-color)',
                                        color: '#fff', padding: '4px 8px', borderRadius: '4px'
                                    }}>
                                        {r.status}
                                    </span>
                                </div>
                                
                                <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginBottom: '10px'}}>
                                    <strong>{r.reporter?.full_name || 'Unknown'}</strong> reported <strong>{r.reported?.full_name || 'Unknown'}</strong>
                                </p>
                                
                                <div style={{
                                    background:'var(--bg-dark)', 
                                    padding:'12px', 
                                    borderRadius:'6px', 
                                    fontStyle:'italic',
                                    borderLeft: '3px solid var(--primary-orange)',
                                    marginBottom: '15px'
                                }}>
                                    "{r.description}"
                                </div>

                                {r.proof_image_url && (
                                    <div style={{marginBottom: '15px'}}>
                                        <a href={r.proof_image_url} target="_blank" rel="noopener noreferrer">
                                            <img 
                                                src={r.proof_image_url} 
                                                alt="Report Proof" 
                                                style={{maxWidth: '100%', maxHeight: '200px', borderRadius: '4px'}} 
                                            />
                                        </a>
                                    </div>
                                )}
                                
                                {r.status !== 'Pending' && r.admin_notes && (
                                    <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                        <strong>Admin Note:</strong> {r.admin_notes}
                                    </p>
                                )}

                                {r.status === 'Pending' && (
                                    <div style={{marginTop:'10px'}}>
                                        <textarea 
                                            value={adminNotes[r.id] || ''}
                                            onChange={(e) => handleNoteChange(r.id, e.target.value)}
                                            placeholder="Enter resolution notes..."
                                            className="form-control"
                                            style={{ width: '100%', minHeight: '80px', marginBottom: '10px' }}
                                        />
                                        
                                        <div style={{display:'flex', gap:'10px'}}>
                                            <button 
                                                onClick={() => handleAction(r.id, r.reported_id, 'ban')} 
                                                className="btn btn-danger btn-full-width"
                                            >
                                                🔨 Ban User
                                            </button>
                                            <button 
                                                onClick={() => handleAction(r.id, r.reported_id, 'dismiss')} 
                                                className="btn btn-secondary btn-full-width"
                                            >
                                                Dismiss Report
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* --- UPDATED: DYNAMIC UNBAN BUTTON --- */}
                                {r.reported?.is_banned && (
                                    <div style={{marginTop:'10px', padding:'10px', background:'rgba(255, 59, 48, 0.1)', borderRadius:'8px'}}>
                                        <p className="error-message small" style={{margin:'0 0 10px 0'}}>
                                            ⚠️ This user is currently BANNED.
                                        </p>
                                        <button 
                                            onClick={() => handleUnban(r.reported_id)}
                                            className="btn btn-success btn-full-width"
                                        >
                                            🔓 Unban User
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}