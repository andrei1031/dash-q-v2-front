import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "./hooks/useTheme";
import { API_URL } from "./http-commons";
import { IconEye, IconEyeOff, IconRefresh } from "./assets/Icon";
import { Bar } from 'react-chartjs-2';

export const AnalyticsDashboard = ({ barberId, refreshSignal }) => {
    // 1. Initialize from Browser Memory (LocalStorage)
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
    const { theme } = useTheme();

     // 2. Custom Toggle Handler (Saves to Memory)
    const handleTogglePrivacy = () => {
        const newState = !showEarnings;
        setShowEarnings(newState);
        localStorage.setItem(`barber_privacy_${barberId}`, JSON.stringify(newState));
    };

    const fetchAnalytics = useCallback(async (isRefreshClick = false) => {
        if (!barberId) return;
        setError('');

        if (isRefreshClick) setIsRefreshing(true);

        try {
            const response = await axios.get(`${API_URL}/analytics/${barberId}`);
            
            setAnalytics(prev => ({ 
                ...prev,
                dailyData: [], 
                busiestDay: { name: 'N/A', earnings: 0 }, 
                ...response.data 
            }));

            const feedbackResponse = await axios.get(`${API_URL}/feedback/${barberId}`);
            setFeedback(feedbackResponse.data || []);

        } catch (err) {
            console.error('Failed fetch analytics:', err);
            if (isLoading) setError('Could not load dashboard data.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [barberId, isLoading]);
    
    useEffect(() => { 
        fetchAnalytics(false); 
    }, [barberId, fetchAnalytics]);

    useEffect(() => { 
        if (refreshSignal > 0) fetchAnalytics(false); 
    }, [refreshSignal, fetchAnalytics]);

    
    // --- CHART CONFIG ---
    const chartTextColor = theme === 'light' ? '#18181B' : '#FFFFFF';
    const chartGridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    const chartOptions = { 
        responsive: true, maintainAspectRatio: false, 
        plugins: { legend: { position: 'top', labels: { color: chartTextColor } }, title: { display: true, text: 'Earnings (7 Days)', color: chartTextColor } }, 
        scales: { y: { beginAtZero: true, ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } } } 
    };
    
    const dailyDataSafe = Array.isArray(analytics.dailyData) ? analytics.dailyData : [];
    const chartData = { labels: dailyDataSafe.map(d => new Date(d.day).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})), datasets: [{ label: 'Earnings (₱)', data: dailyDataSafe.map(d => d.daily_earnings), backgroundColor: 'rgba(52, 199, 89, 0.6)', borderColor: 'rgba(52, 199, 89, 1)', borderWidth: 1 }] };
    
    const avgPriceToday = (analytics.totalCutsToday ?? 0) > 0 ? ((analytics.totalEarningsToday ?? 0) / analytics.totalCutsToday).toFixed(2) : '0.00';
    const carbonStatusMessage = (analytics.carbonSavedToday || 0) > 0 ? "✅ Daily Goal Reached!" : "⏳ Waiting for cuts...";

    // --- 🟢 FIX: LAYOUT GRID STYLE ---
    // Increased min-width to 220px to force a 2x2 grid on medium screens instead of 3x1 + 1 orphan.
    const dynamicGridStyle = {
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' 
    };


    return (
        <div className="card">
            <div className="card-header">
                <h2>Dashboard</h2>
                <button 
                    onClick={handleTogglePrivacy} 
                    className="btn btn-secondary btn-icon-label"
                >
                    {showEarnings ? <IconEyeOff /> : <IconEye />}
                    {showEarnings ? 'Hide' : 'Show'}
                </button>
            </div>
            
            <div className="card-body">
                {error && <p className="error-message">{error}</p>}
                
                <h3 className="analytics-subtitle">Today</h3>
                <div className="analytics-grid" style={dynamicGridStyle}>
                    {showEarnings && <div className="analytics-item"><span className="analytics-label">Earnings</span><span className="analytics-value">₱{analytics.totalEarningsToday ?? 0}</span></div>}
                    <div className="analytics-item"><span className="analytics-label">Cuts Today</span><span className="analytics-value">{analytics.totalCutsToday ?? 0}</span></div>
                    {showEarnings && <div className="analytics-item"><span className="analytics-label">Avg Price</span><span className="analytics-value small">₱{avgPriceToday}</span></div>}
                    <div className="analytics-item"><span className="analytics-label">Current Queue</span><span className="analytics-value small">{analytics.currentQueueSize ?? 0}</span></div>
                </div>

                <h3 className="analytics-subtitle">Last 7 Days</h3>
                <div className="analytics-grid" style={dynamicGridStyle}>
                    {showEarnings && <div className="analytics-item"><span className="analytics-label">Total Earnings</span><span className="analytics-value">₱{analytics.totalEarningsWeek ?? 0}</span></div>}
                    
                    <div className="analytics-item"><span className="analytics-label">Total Cuts</span><span className="analytics-value">{analytics.totalCutsWeek ?? 0}</span></div>
                    
                    <div className="analytics-item">
                        <span className="analytics-label">Busiest Day</span>
                        <span className="analytics-value small" style={{fontSize: '1.2rem'}}>
                            {analytics.busiestDay?.name || 'N/A'}
                            {showEarnings && analytics.busiestDay?.earnings > 0 && (
                                <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                    (₱{analytics.busiestDay.earnings})
                                </div>
                            )}
                        </span>
                    </div>

                    <div className="analytics-item"><span className="analytics-label">All-Time Cuts</span><span className="analytics-value small">{analytics.totalCutsAllTime ?? 0}</span></div>
                </div>
                
                <div className="carbon-footprint-section">
                    <h3 className="analytics-subtitle">🌱 Shop Carbon Savings</h3>
                    <div className="analytics-grid carbon-grid" style={dynamicGridStyle}>
                        <div className="analytics-item">
                            <span className="analytics-label">Today's Impact</span>
                            <span className="analytics-value carbon">+{analytics.carbonSavedToday || 0}g</span>
                            <small style={{color: 'var(--text-secondary)', fontSize: '0.8rem'}}>{carbonStatusMessage}</small>
                        </div>
                        <div className="analytics-item">
                            <span className="analytics-label">All-Time Reduced</span>
                            <span className="analytics-value carbon">{analytics.carbonSavedTotal || 0}g</span>
                        </div>
                    </div>
                </div>

                {showEarnings && (
                    <div className="chart-container">
                        {dailyDataSafe.length > 0 ? (
                            <div style={{ height: '200px' }}><Bar options={chartOptions} data={chartData} /></div>
                        ) : (<p className='empty-text'>No chart data yet.</p>)}
                    </div>
                )}
                
                <div className="feedback-list-container">
                    <h3 className="analytics-subtitle">Recent Feedback</h3>
                    <ul className="feedback-list">
                        {feedback.length > 0 ? feedback.map((item, index) => (
                            <li key={index} className="feedback-item">
                                <div className="feedback-header">
                                    <span className="feedback-score" style={{color: '#FFD700'}}>
                                        {'★'.repeat(Math.round(item.score || 0))}
                                    </span>
                                    <span className="feedback-customer">{item.customer_name}</span>
                                </div>
                                {item.comments && <p className="feedback-comment">"{item.comments}"</p>}
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
