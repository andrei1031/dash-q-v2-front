import axios from "axios";
import { useEffect, useState } from "react";
import { API_URL } from "../http-commons";
import { IconX } from "../assets/Icon";

export const MyReportsModal = ({ isOpen, onClose, userId }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            axios.get(`${API_URL}/reports/my/${userId}`)
                .then(res => setReports(res.data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header" style={{padding: '20px 25px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h2 style={{margin:0, color: 'var(--primary-orange)'}}>My Reports</h2>
                    <button onClick={onClose} className="btn btn-icon"><IconX /></button>
                </div>
                <div className="modal-body" style={{textAlign:'left', maxHeight: '60vh', overflowY: 'auto'}}>
                    {loading ? <p className="empty-text">Loading reports...</p> : reports.length === 0 ? (
                        <p className="empty-text">You haven't submitted any reports.</p>
                    ) : (
                        <ul className="queue-list">
                            {reports.map(r => (
                                <li key={r.id} style={{display:'block', marginBottom:'10px', padding:'15px'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                                        <strong>{r.reason}</strong>
                                        <span className="status-badge" style={{
                                            backgroundColor: r.status === 'Pending' ? 'rgba(255, 149, 0, 0.2)' : 
                                                        r.status === 'Resolved' ? 'rgba(52, 199, 89, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                                            color: r.status === 'Pending' ? 'var(--primary-orange)' : 
                                                r.status === 'Resolved' ? 'var(--success-color)' : 'var(--text-secondary)'
                                        }}>
                                            {r.status}
                                        </span>
                                    </div>
                                    <p style={{fontSize:'0.85rem', color:'var(--text-secondary)', margin:'0 0 5px'}}>
                                        Reported: <strong>{r.reported?.full_name || 'Unknown User'}</strong>
                                    </p>
                                    <p style={{fontSize:'0.9rem', marginBottom:'10px'}}>"{r.description}"</p>
                                    
                                    {r.admin_notes && (
                                        <div style={{background:'var(--bg-dark)', padding:'10px', borderRadius:'6px', borderLeft:'3px solid var(--link-color)'}}>
                                            <strong style={{fontSize:'0.8rem', color:'var(--link-color)'}}>Admin Response:</strong>
                                            <p style={{margin:'5px 0 0', fontSize:'0.9rem'}}>{r.admin_notes}</p>
                                        </div>
                                    )}
                                    <div style={{textAlign:'right', marginTop:'10px', fontSize:'0.75rem', color:'var(--text-secondary)'}}>
                                        {new Date(r.created_at).toLocaleDateString()}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="modal-footer single-action">
                    <button onClick={onClose} className="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    )
}
