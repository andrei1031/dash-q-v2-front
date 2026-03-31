import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "./http-commons";

export const AnalyticsDashboard = ({ barberId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [barberFeedback, setBarberFeedback] = useState([]);

  useEffect(() => {
    if (!barberId) return;
    
    setLoading(true);

    // 1. Fetch Analytics
    const fetchAnalytics = axios.get(`${API_URL}/barber/${barberId}/analytics`);
    
    // 2. Fetch Feedback
    const fetchFeedback = axios.get(`${API_URL}/feedback/${barberId}`);

    Promise.all([fetchAnalytics, fetchFeedback])
      .then(([analyticsRes, feedbackRes]) => {
        setData(analyticsRes.data);
        setBarberFeedback(feedbackRes.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard load error:", err);
        setError("Failed to sync dashboard data.");
        setLoading(false);
      });
  }, [barberId]);

  if (loading) return <div className="card"><div className="card-body"><p className="empty-text">Loading dashboard...</p></div></div>;
  if (error) return <div className="card"><div className="card-body"><p className="error-message">{error}</p></div></div>;
  if (!data) return null;

  return (
    <div className="card analytics-card">
      <div className="card-header">
        <h2>Analytics & Feedback</h2>
      </div>
      <div className="card-body" style={{ padding: '20px' }}>

        <h3 className="analytics-subtitle" style={{marginTop: 0}}>Today</h3>
        <div className="analytics-grid">
            <div className="analytics-item">
                <span className="analytics-label">Earnings</span>
                <span className="analytics-value">₱{data.totalEarningsToday || 0}</span>
            </div>
            <div className="analytics-item">
                <span className="analytics-label">Cuts Today</span>
                <span className="analytics-value">{data.totalCutsToday || 0}</span>
            </div>
            <div className="analytics-item">
                <span className="analytics-label">Avg Price</span>
                <span className="analytics-value small">₱{data.totalCutsToday ? (data.totalEarningsToday / data.totalCutsToday).toFixed(2) : '0.00'}</span>
            </div>
            <div className="analytics-item">
                <span className="analytics-label">Current Queue</span>
                <span className="analytics-value">{data.currentQueueSize || 0}</span>
            </div>
        </div>

        <h3 className="analytics-subtitle">Last 7 Days</h3>
        <div className="analytics-grid">
            <div className="analytics-item">
                <span className="analytics-label">Total Earnings</span>
                <span className="analytics-value">₱{data.totalEarningsWeek || 0}</span>
            </div>
            <div className="analytics-item">
                <span className="analytics-label">Total Cuts</span>
                <span className="analytics-value">{data.totalCutsWeek || 0}</span>
            </div>
            <div className="analytics-item">
                <span className="analytics-label">Busiest Day</span>
                <span className="analytics-value small">{data.busiestDay?.name || 'N/A'}</span>
            </div>
            <div className="analytics-item">
                <span className="analytics-label">All-Time Cuts</span>
                <span className="analytics-value">{data.totalCutsAllTime || 0}</span>
            </div>
        </div>

        <div className="feedback-list-container">
            <h3 className="feedback-subtitle" style={{marginBottom: '10px'}}>Recent Feedback</h3>
            {barberFeedback.length > 0 ? (
                <ul className="feedback-list" style={{maxHeight: '300px', overflowY: 'auto'}}>
                    {barberFeedback.map((item, index) => (
                        <li key={index} className="feedback-item">
                            <div className="feedback-header">
                                <span className="feedback-score" style={{fontSize: '1.1rem', lineHeight: '1'}}>
                                    <span style={{color: '#FFD700'}}>
                                        {'★'.repeat(Math.round(Math.max(0, Math.min(5, item.score || 0))))}
                                    </span>
                                    <span style={{color: 'var(--text-secondary)'}}>
                                        {'☆'.repeat(5 - Math.round(Math.max(0, Math.min(5, item.score || 0))))}
                                    </span>
                                </span>
                                <span className="feedback-customer" style={{marginLeft: '10px'}}>
                                    {item.customer_name || 'Customer'}
                                </span>
                            </div>
                            {item.comments && <p className="feedback-comment" style={{margin: '5px 0 0 0', opacity: 0.8}}>"{item.comments}"</p>}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="empty-text">No feedback received yet.</p>
            )}
        </div>

      </div>
    </div>
  );
};