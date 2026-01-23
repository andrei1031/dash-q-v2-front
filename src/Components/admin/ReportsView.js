import { useEffect, useState } from "react";
import { API_URL } from "../http-commons";
import axios from "axios";

export const ReportsView = () => {

    const [reports, setReports] = useState([]);
        // NEW: State to track notes for each specific report ID
        const [adminNotes, setAdminNotes] = useState({}); 
        
        const fetchReports = async () => {
            try {
                const res = await axios.get(`${API_URL}/admin/reports`);
                setReports(res.data);
            } catch (error) {
                console.error("Failed to load reports", error);
            }
        };
        useEffect(() => { fetchReports(); }, []);

        const handleAction = async (reportId, targetId, action) => {
            const note = adminNotes[reportId] || ''; // Get the note for this specific report
            
            // Confirm action with the admin
            if(!window.confirm(`Are you sure you want to ${action.toUpperCase()} this user?`)) return;
            
            try {
                // Send the action AND the note to the backend
                await axios.put(`${API_URL}/admin/reports/resolve`, { 
                    reportId, 
                    targetUserId: targetId, 
                    action,
                    adminNotes: note 
                });
                
                alert(`Action taken: ${action}`);
                
                // Clear the note from state and refresh list
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
          // Helper to update notes state
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

                                    {/* --- NEW: Display Proof Image --- */}
                                    {r.proof_image_url && (
                                        <div style={{marginBottom: '15px'}}>
                                            <strong style={{fontSize: '0.85rem', color:'var(--text-secondary)'}}>Attached Proof:</strong>
                                            <br />
                                            <a href={r.proof_image_url} target="_blank" rel="noopener noreferrer">
                                                <img 
                                                    src={r.proof_image_url} 
                                                    alt="Report Proof" 
                                                    style={{maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', marginTop: '5px', border:'1px solid var(--border-color)'}} 
                                                />
                                            </a>
                                        </div>
                                    )}
                                    
                                    {/* NEW: Display Admin Notes if resolved */}
                                    {r.status !== 'Pending' && r.admin_notes && (
                                        <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                            <strong>Admin Note:</strong> {r.admin_notes}
                                        </p>
                                    )}

                                    {/* Action Area (Only for Pending Reports) */}
                                    {r.status === 'Pending' && (
                                        <div style={{marginTop:'10px'}}>
                                            {/* NEW: Admin Note Input Area */}
                                            <textarea 
                                                value={adminNotes[r.id] || ''}
                                                onChange={(e) => handleNoteChange(r.id, e.target.value)}
                                                placeholder="Enter resolution notes here (e.g., 'Verified via CCTV', 'First warning')..."
                                                style={{
                                                    width: '100%',
                                                    minHeight: '120px', /* Reasonable height for typing */
                                                    padding: '15px',
                                                    marginTop: '15px',
                                                    borderRadius: '12px',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--bg-dark)', /* Blends with theme */
                                                    color: 'var(--text-primary)',
                                                    fontSize: '1rem',
                                                    lineHeight: '1.5',
                                                    resize: 'none', /* Prevents user from breaking layout */
                                                    fontFamily: 'inherit',
                                                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)', /* Inner shadow depth */
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = 'var(--primary-orange)';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(255, 149, 0, 0.1)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = 'var(--border-color)';
                                                    e.target.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.2)';
                                                }}
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
                                    
                                    {r.reported?.is_banned && (
                                        <p className="error-message small" style={{marginTop:'10px'}}>
                                            ⚠️ This user is currently BANNED.
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        );
}
