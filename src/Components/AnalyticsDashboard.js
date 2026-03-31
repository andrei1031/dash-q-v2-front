import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "./http-commons";
import { IconEye, IconEyeOff, IconRefresh } from "./assets/Icon";

export const AnalyticsDashboard = ({ barberId, refreshSignal }) => {

    // 1. Initialize Privacy State from Memory
    const [showEarnings, setShowEarnings] = useState(() => {
        if (!barberId) return true;
        const saved = localStorage.getItem(`barber_privacy_${barberId}`);
        return saved !== null ? JSON.parse(saved) : true;
    });

    const [analytics, setAnalytics] = useState({ 
        totalEarningsToday: 0, totalCutsToday: 0, 
        totalEarningsWeek: 0, totalCutsWeek: 0, 
        dailyData: [], busiestDay: { name: 'N/A', earnings: 0 }, 
        currentQueueSize: 0, totalCutsAllTime: 0, carbonSavedToday: 0, carbonSavedTotal: 0 
    });
    const [feedback, setFeedback] = useState([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleTogglePrivacy = () => {
        const newState = !showEarnings;
        setShowEarnings(newState);
        localStorage.setItem(`barber_privacy_${barberId}`, JSON.stringify(newState));
    };

    const fetchAnalytics = useCallback(async (isManual = false) => {
        if (!barberId) return;
        if (isManual) setIsRefreshing(true);
        
        try {
            // Fetch both stats and feedback at once
            const [analyticsRes, feedbackRes] = await Promise.all([
                // Removed the extra /barber/ prefix to match your server.js setup
                axios.get(`${API_URL}/analytics/${barberId}`),
                axios.get(`${API_URL}/feedback/${barberId}`)
            ]);
            
            setAnalytics(analyticsRes.data);
            setFeedback(feedbackRes.data || []);
            setError('');
        } catch (err) {
            console.error("Dashboard Sync Error:", err);
            setError("Could not refresh stats.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [barberId]);

    useEffect(() => {
        fetchAnalytics();
        const interval = setInterval(() => fetchAnalytics(), 60000); 
        return () => clearInterval(interval);
    }, [fetchAnalytics, refreshSignal]);

    if (isLoading) return <div className="card"><div className="card-body"><p className="empty-text">Loading stats...</p></div></div>;

    return (
        <div className="card analytics-card">
            <div className="card-header">
                <h2>Dashboard</h2>
                <button onClick={handleTogglePrivacy} className="btn-icon" title={showEarnings ? "Hide Private Stats" : "Show Private Stats"}>
                    {showEarnings ? <IconEyeOff /> : <IconEye />}
                </button>
            </div>
            
            <div className="card-body">
                {error && <p className="message error small">{error}</p>}
                
                <h3 className="analytics-subtitle">Today</h3>
                <div className="analytics-grid">
                    <div className="analytics-item">
                        <span className="analytics-label">Earnings</span>
                        <span className="analytics-value">
                            {showEarnings ? `₱${analytics.totalEarningsToday}` : "••••"}
                        </span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">Cuts Today</span>
                        <span className="analytics-value">{analytics.totalCutsToday}</span>
                    </div>
                </div>

                <h3 className="analytics-subtitle">Last 7 Days</h3>
                <div className="analytics-grid">
                    <div className="analytics-item">
                        <span className="analytics-label">Total Earnings</span>
                        <span className="analytics-value">
                            {showEarnings ? `₱${analytics.totalEarningsWeek}` : "••••"}
                        </span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">Total Cuts</span>
                        <span className="analytics-value">{analytics.totalCutsWeek}</span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">Busiest Day</span>
                        <span className="analytics-value small">{analytics.busiestDay?.name || 'N/A'}</span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">All-Time Cuts</span>
                        <span className="analytics-value">{analytics.totalCutsAllTime}</span>
                    </div>
                </div>

                <h3 className="analytics-subtitle">Shop Carbon Savings</h3>
                <div className="analytics-grid carbon-grid">
                    <div className="analytics-item">
                        <span className="analytics-label">Today's Impact</span>
                        <span className="analytics-value carbon">+{analytics.carbonSavedToday}<small className="carbon-unit">g</small></span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">All-Time Reduced</span>
                        <span className="analytics-value carbon">{analytics.carbonSavedTotal >= 1000 ? (analytics.carbonSavedTotal/1000).toFixed(1) : analytics.carbonSavedTotal}<small className="carbon-unit">{analytics.carbonSavedTotal >= 1000 ? 'kg' : 'g'}</small></span>
                    </div>
                </div>

                <div className="feedback-list-container" style={{marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px'}}>
                    <h3 className="analytics-subtitle">Recent Feedback</h3>
                    <ul className="feedback-list">
                        {feedback.length > 0 ? feedback.map((item, index) => (
                            <li key={index} className="feedback-item">
                                <div className="feedback-header">
                                    <span className="feedback-score" style={{color: '#FFD700', fontSize: '1.2rem'}}>
                                        {'★'.repeat(Math.round(item.score || 0))}
                                    </span>
                                    <span className="feedback-customer" style={{marginLeft: '10px', fontWeight: 'bold'}}>
                                        {item.customer_name}
                                    </span>
                                </div>
                                {item.comments && <p className="feedback-comment" style={{fontStyle: 'italic', color: 'var(--text-secondary)'}}>"{item.comments}"</p>}
                            </li>
                        )) : <p className="empty-text">No feedback yet.</p>}
                    </ul>
                </div>
            </div>
            
            <div className="card-footer">
                <button onClick={() => fetchAnalytics(true)} className="btn btn-secondary btn-full-width btn-icon-label" disabled={isRefreshing}>
                    <IconRefresh />
                    {isRefreshing ? 'Refreshing...' : 'Refresh Stats'}
                </button>
            </div>
        </div>
    );
}